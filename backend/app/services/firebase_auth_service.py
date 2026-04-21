import requests
from firebase_admin import auth as firebase_auth

from backend.app.core.settings import firebase_client
from backend.app.services.firestore_service import upsert_user_profile

IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1"
SECURE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token"
FIREBASE_API_KEY = firebase_client["apiKey"]
PASSWORD_PROVIDER = "password"
GOOGLE_PROVIDER = "google.com"


class FirebaseAuthError(Exception):
    def __init__(self, code: str, message: str | None = None, status_code: int = 400):
        super().__init__(message or code)
        self.code = code
        self.status_code = status_code


def _auth_error_code(message: str) -> str:
    normalized = message.upper()

    if normalized.startswith("WEAK_PASSWORD"):
        return "auth/weak-password"

    known_errors = {
        "EMAIL_EXISTS": "auth/email-already-in-use",
        "EMAIL_NOT_FOUND": "auth/user-not-found",
        "INVALID_PASSWORD": "auth/wrong-password",
        "INVALID_LOGIN_CREDENTIALS": "auth/invalid-credential",
        "OPERATION_NOT_ALLOWED": "auth/operation-not-allowed",
        "TOO_MANY_ATTEMPTS_TRY_LATER": "auth/too-many-requests",
        "USER_DISABLED": "auth/user-disabled",
        "INVALID_ID_TOKEN": "auth/invalid-credential",
        "TOKEN_EXPIRED": "auth/invalid-credential",
        "INVALID_REFRESH_TOKEN": "auth/invalid-credential",
        "CREDENTIAL_TOO_OLD_LOGIN_AGAIN": "auth/requires-recent-login",
    }
    return known_errors.get(normalized, message.lower().replace("_", "-"))


def _extract_error_message(payload: object) -> str:
    if not isinstance(payload, dict):
        return "firebase auth failed"

    error = payload.get("error")
    if isinstance(error, dict) and isinstance(error.get("message"), str):
        return error["message"]

    return "firebase auth failed"


def _post_identity(path: str, payload: dict) -> dict:
    response = requests.post(
        f"{IDENTITY_TOOLKIT_URL}/{path}?key={FIREBASE_API_KEY}",
        json=payload,
        timeout=10,
    )
    data = response.json() if response.content else {}

    if response.status_code != 200:
        message = _extract_error_message(data)
        raise FirebaseAuthError(_auth_error_code(message), message, response.status_code)

    return data


def _post_secure_token(payload: dict) -> dict:
    response = requests.post(
        f"{SECURE_TOKEN_URL}?key={FIREBASE_API_KEY}",
        data=payload,
        timeout=10,
    )
    data = response.json() if response.content else {}

    if response.status_code != 200:
        message = _extract_error_message(data)
        raise FirebaseAuthError(_auth_error_code(message), message, response.status_code)

    return data


def _claim_providers(id_token: str) -> list[str]:
    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception:
        return []

    providers = decoded.get("providers")
    if not isinstance(providers, list):
        return []

    return [provider for provider in providers if isinstance(provider, str)]


def lookup_id_token(id_token: str) -> dict:
    data = _post_identity("accounts:lookup", {"idToken": id_token})
    users = data.get("users") or []

    if not users:
        raise FirebaseAuthError("auth/invalid-credential", "Firebase token has no user", 401)

    user = users[0]
    provider_info = user.get("providerUserInfo") or []
    providers = [
        provider.get("providerId")
        for provider in provider_info
        if provider.get("providerId")
    ]

    if user.get("passwordHash") and PASSWORD_PROVIDER not in providers:
        providers.append(PASSWORD_PROVIDER)

    return {
        "uid": user.get("localId", ""),
        "email": user.get("email", ""),
        "name": user.get("displayName", ""),
        "picture": user.get("photoUrl", ""),
        "providers": providers,
    }


def fetch_sign_in_methods(email: str) -> list[str]:
    data = _post_identity(
        "accounts:createAuthUri",
        {
            "identifier": email,
            "continueUri": "http://localhost",
        },
    )
    methods = data.get("signInMethods") or []
    return [method for method in methods if isinstance(method, str)]


def auth_response_from_id_token(
    id_token: str,
    refresh_token: str | None = None,
    fallback_providers: list[str] | None = None,
) -> dict:
    user = lookup_id_token(id_token)
    providers = sorted(
        set(user.get("providers", []))
        | set(_claim_providers(id_token))
        | set(fallback_providers or [])
    )
    profile = upsert_user_profile(
        uid=user["uid"],
        email=user.get("email", ""),
        display_name=user.get("name", ""),
        photo_url=user.get("picture", ""),
        providers=providers,
    )

    return {
        "uid": user["uid"],
        "email": user.get("email", ""),
        "displayName": profile.get("display_name", ""),
        "photoURL": profile.get("photo_url", ""),
        "providers": profile.get("providers", providers),
        "token": id_token,
        "refreshToken": refresh_token,
    }


def sign_up_with_email(email: str, password: str) -> dict:
    data = _post_identity(
        "accounts:signUp",
        {
            "email": email,
            "password": password,
            "returnSecureToken": True,
        },
    )
    return auth_response_from_id_token(
        data["idToken"],
        data.get("refreshToken"),
        [PASSWORD_PROVIDER],
    )


def sign_in_with_email(email: str, password: str) -> dict:
    try:
        data = _post_identity(
            "accounts:signInWithPassword",
            {
                "email": email,
                "password": password,
                "returnSecureToken": True,
            },
        )
    except FirebaseAuthError as error:
        if error.code in {"auth/invalid-credential", "auth/wrong-password"}:
            try:
                methods = fetch_sign_in_methods(email)
            except FirebaseAuthError:
                methods = []

            if GOOGLE_PROVIDER in methods and PASSWORD_PROVIDER not in methods:
                raise FirebaseAuthError(
                    "auth/google-account-without-password",
                    "This email uses Google sign-in.",
                ) from error
        raise

    return auth_response_from_id_token(
        data["idToken"],
        data.get("refreshToken"),
        [PASSWORD_PROVIDER],
    )


def sign_in_with_custom_token(custom_token: str, providers: list[str] | None = None) -> dict:
    data = _post_identity(
        "accounts:signInWithCustomToken",
        {
            "token": custom_token,
            "returnSecureToken": True,
        },
    )
    return auth_response_from_id_token(
        data["idToken"],
        data.get("refreshToken"),
        providers,
    )


def refresh_session(refresh_token: str) -> dict:
    data = _post_secure_token(
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
    )
    return auth_response_from_id_token(
        data["id_token"],
        data.get("refresh_token"),
    )


def link_password(id_token: str, password: str) -> dict:
    data = _post_identity(
        "accounts:update",
        {
            "idToken": id_token,
            "password": password,
            "returnSecureToken": True,
        },
    )
    return auth_response_from_id_token(
        data["idToken"],
        data.get("refreshToken"),
        [PASSWORD_PROVIDER],
    )
