import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlparse
from uuid import uuid4

import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from firebase_admin import auth as firebase_auth
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token

from backend.app.core.settings import google_login
from backend.app.dependencies.auth import get_current_token, get_current_user
from backend.app.schemas.auth import (
    EmailPasswordRequest,
    LinkPasswordRequest,
    RefreshSessionRequest,
)
from backend.app.services.firebase_auth_service import (
    FirebaseAuthError,
    link_password as link_firebase_password,
    refresh_session,
    sign_in_with_custom_token,
    sign_in_with_email,
    sign_up_with_email,
)
from backend.app.services.firestore_service import upsert_user_profile

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_PROVIDER = "google.com"
SESSION_TTL_SECONDS = 300
DEFAULT_FRONTEND_URL = "http://127.0.0.1:5173"
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}

_oauth_states: dict[str, dict] = {}
_google_sessions: dict[str, dict] = {}


def _now():
    return datetime.now(timezone.utc)


def _cleanup_oauth_cache():
    now = _now()

    for key, value in list(_oauth_states.items()):
        if value["expires_at"] < now:
            _oauth_states.pop(key, None)

    for key, value in list(_google_sessions.items()):
        if value["expires_at"] < now:
            _google_sessions.pop(key, None)


def _normalized_url(value: str | None) -> str:
    if not value:
        return ""

    url = value.strip().rstrip("/")
    parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""

    return url


def _is_loopback_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.hostname in LOOPBACK_HOSTS


def _configured_frontend_urls() -> list[str]:
    urls: list[str] = []
    primary_url = _normalized_url(google_login.get("frontend_url") or DEFAULT_FRONTEND_URL)

    if primary_url:
        urls.append(primary_url)

    configured_urls = google_login.get("allowed_frontend_urls") or []
    if isinstance(configured_urls, str):
        configured_urls = [configured_urls]

    for url in configured_urls:
        normalized = _normalized_url(str(url))
        if normalized and normalized not in urls:
            urls.append(normalized)

    return urls or [DEFAULT_FRONTEND_URL]


def _frontend_url(value: str | None = None) -> str:
    requested_url = _normalized_url(value)
    configured_urls = _configured_frontend_urls()

    if requested_url and (
        _is_loopback_url(requested_url) or requested_url in configured_urls
    ):
        return requested_url

    for configured_url in configured_urls:
        if configured_url:
            return configured_url

    return DEFAULT_FRONTEND_URL


def _redirect_with_error(frontend_url: str, error: str):
    return RedirectResponse(f"{frontend_url}/#auth_error={error}")


def _raise_auth_error(error: FirebaseAuthError):
    raise HTTPException(status_code=error.status_code, detail=error.code)


def _get_or_create_user_from_google(profile: dict):
    email = profile.get("email", "")

    if not email:
        raise ValueError("missing google email")

    try:
        user = firebase_auth.get_user_by_email(email)
    except firebase_auth.UserNotFoundError:
        user = firebase_auth.create_user(
            email=email,
            email_verified=bool(profile.get("email_verified")),
            display_name=profile.get("name", ""),
            photo_url=profile.get("picture", ""),
        )

    upsert_user_profile(
        uid=user.uid,
        email=email,
        display_name=profile.get("name", ""),
        photo_url=profile.get("picture", ""),
        providers=[GOOGLE_PROVIDER],
    )
    return user


@router.post("/signup")
def signup(payload: EmailPasswordRequest):
    try:
        return sign_up_with_email(payload.email, payload.password)
    except FirebaseAuthError as error:
        _raise_auth_error(error)


@router.post("/login")
def login(payload: EmailPasswordRequest):
    try:
        return sign_in_with_email(payload.email, payload.password)
    except FirebaseAuthError as error:
        _raise_auth_error(error)


@router.post("/session/refresh")
def refresh(payload: RefreshSessionRequest):
    try:
        return refresh_session(payload.refreshToken)
    except FirebaseAuthError as error:
        _raise_auth_error(error)


@router.post("/session/link-password")
def link_password(
    payload: LinkPasswordRequest,
    token: str = Depends(get_current_token),
):
    try:
        return link_firebase_password(token, payload.password)
    except FirebaseAuthError as error:
        _raise_auth_error(error)


@router.get("/google/start")
def google_start(frontend_url: str | None = None):
    if not google_login:
        raise HTTPException(status_code=500, detail="Google login is not configured")

    client_id = google_login.get("google_client_id")
    redirect_uri = google_login.get("google_redirect_uri")

    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google login is not configured")

    _cleanup_oauth_cache()
    state = uuid4().hex
    safe_frontend_url = _frontend_url(frontend_url)
    _oauth_states[state] = {
        "frontend_url": safe_frontend_url,
        "expires_at": _now() + timedelta(seconds=SESSION_TTL_SECONDS),
    }

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    _cleanup_oauth_cache()
    state_data = _oauth_states.pop(state or "", None)
    frontend_url = _frontend_url(state_data.get("frontend_url") if state_data else None)

    if error:
        return _redirect_with_error(frontend_url, error)

    if not code or not state_data:
        return _redirect_with_error(frontend_url, "missing_google_code")

    try:
        token_response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": google_login.get("google_client_id"),
                "client_secret": google_login.get("google_client_secret"),
                "redirect_uri": google_login.get("google_redirect_uri"),
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        token_response.raise_for_status()
        google_token = token_response.json().get("id_token")

        if not google_token:
            return _redirect_with_error(frontend_url, "missing_google_id_token")

        profile = google_id_token.verify_oauth2_token(
            google_token,
            GoogleRequest(),
            google_login.get("google_client_id"),
            clock_skew_in_seconds=10,
        )
        user = _get_or_create_user_from_google(profile)
        custom_token = firebase_auth.create_custom_token(
            user.uid,
            {"providers": [GOOGLE_PROVIDER]},
        ).decode("utf-8")
        auth_session = sign_in_with_custom_token(custom_token, [GOOGLE_PROVIDER])
        session_id = uuid4().hex
        _google_sessions[session_id] = {
            "auth_session": auth_session,
            "expires_at": _now() + timedelta(seconds=SESSION_TTL_SECONDS),
        }
        return RedirectResponse(f"{frontend_url}/#google_session={session_id}")
    except requests.HTTPError:
        logger.exception("Google token exchange failed")
        return _redirect_with_error(frontend_url, "google_token_exchange_failed")
    except FirebaseAuthError:
        logger.exception("Firebase Google session exchange failed")
        return _redirect_with_error(frontend_url, "firebase_session_exchange_failed")
    except Exception:
        logger.exception("Google login failed")
        return _redirect_with_error(frontend_url, "google_login_failed")


@router.get("/google/session/{session_id}")
def google_session(session_id: str):
    _cleanup_oauth_cache()
    session = _google_sessions.pop(session_id, None)

    if not session:
        raise HTTPException(status_code=404, detail="Google session expired")

    return session["auth_session"]


@router.get("/me")
def me(user=Depends(get_current_user)):
    profile = upsert_user_profile(
        uid=user.get("uid"),
        email=user.get("email", ""),
        display_name=user.get("name", ""),
        photo_url=user.get("picture", ""),
        providers=user.get("providers", []),
    )

    return {
        "uid": user.get("uid"),
        "email": user.get("email", ""),
        "displayName": profile.get("display_name", ""),
        "photoURL": profile.get("photo_url", ""),
        "providers": profile.get("providers", []),
    }
