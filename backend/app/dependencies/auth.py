from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth

from backend.app.services.firebase_auth_service import lookup_id_token

security = HTTPBearer()


def get_current_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    return credentials.credentials


def _provider_ids_from_user_record(uid: str) -> list[str]:
    user_record = firebase_auth.get_user(uid)
    return [
        provider.provider_id
        for provider in user_record.provider_data
        if provider.provider_id
    ]


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        decoded = firebase_auth.verify_id_token(token)
        uid = decoded.get("uid")
        claim_providers = decoded.get("providers") if isinstance(decoded.get("providers"), list) else []

        if uid:
            try:
                decoded["providers"] = sorted(set(_provider_ids_from_user_record(uid)) | set(claim_providers))
            except Exception:
                firebase_info = decoded.get("firebase") or {}
                sign_in_provider = firebase_info.get("sign_in_provider")
                fallback_providers = [sign_in_provider] if sign_in_provider else []
                decoded["providers"] = sorted(set(fallback_providers) | set(claim_providers))

        return decoded
    except Exception:
        try:
            return lookup_id_token(token)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
