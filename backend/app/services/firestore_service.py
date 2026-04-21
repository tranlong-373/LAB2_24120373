from datetime import datetime, timezone

from google.cloud.firestore_v1 import Query

from backend.app.core.firebase_config import db

MAX_TITLE_LENGTH = 56


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_timestamp(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def _user_ref(uid: str):
    return db.collection("users").document(uid)


def upsert_user_profile(
    uid: str,
    email: str = "",
    display_name: str = "",
    photo_url: str = "",
    providers: list[str] | None = None,
):
    now = _now()
    doc_ref = _user_ref(uid)
    snapshot = doc_ref.get()
    existing = snapshot.to_dict() if snapshot.exists else {}
    provider_values = sorted(set(existing.get("providers") or []) | set(providers or []))

    data = {
        "uid": uid,
        "email": email or existing.get("email", ""),
        "display_name": display_name or existing.get("display_name", ""),
        "photo_url": photo_url or existing.get("photo_url", ""),
        "providers": provider_values,
        "updated_at": now,
        "last_login_at": now,
    }

    if not snapshot.exists:
        data["created_at"] = now

    doc_ref.set(data, merge=True)
    profile = doc_ref.get().to_dict() or data
    return {
        "uid": profile.get("uid", uid),
        "email": profile.get("email", ""),
        "display_name": profile.get("display_name", ""),
        "photo_url": profile.get("photo_url", ""),
        "providers": profile.get("providers", []),
        "created_at": _serialize_timestamp(profile.get("created_at")),
        "updated_at": _serialize_timestamp(profile.get("updated_at")),
        "last_login_at": _serialize_timestamp(profile.get("last_login_at")),
    }


def _conversation_ref(uid: str, conversation_id: str):
    return _user_ref(uid).collection("conversations").document(conversation_id)


def _message_collection(uid: str, conversation_id: str):
    return _conversation_ref(uid, conversation_id).collection("messages")


def _conversation_from_snapshot(snapshot):
    data = snapshot.to_dict() or {}
    return {
        "id": snapshot.id,
        "title": data.get("title") or "",
        "created_at": _serialize_timestamp(data.get("created_at")),
        "updated_at": _serialize_timestamp(data.get("updated_at")),
    }


def _message_from_snapshot(snapshot):
    data = snapshot.to_dict() or {}
    return {
        "id": snapshot.id,
        "role": data.get("role", "assistant"),
        "content": data.get("content", ""),
        "created_at": _serialize_timestamp(data.get("created_at")),
    }


def _clean_title(title: str | None) -> str:
    return " ".join((title or "").split())


def _title_from_message(message: str) -> str:
    cleaned = " ".join(message.split())

    if not cleaned:
        return "Cuộc trò chuyện mới"

    words = cleaned.split()
    title = " ".join(words[:8])

    if len(title) > MAX_TITLE_LENGTH:
        title = f"{title[: MAX_TITLE_LENGTH - 3].rstrip()}..."

    return title


def get_conversation(uid: str, conversation_id: str):
    snapshot = _conversation_ref(uid, conversation_id).get()

    if not snapshot.exists:
        return None

    return _conversation_from_snapshot(snapshot)


def create_conversation(uid: str, title: str | None = None):
    now = _now()
    doc_ref = _user_ref(uid).collection("conversations").document()
    doc_ref.set({
        "title": _clean_title(title),
        "created_at": now,
        "updated_at": now,
    })
    return _conversation_from_snapshot(doc_ref.get())


def list_conversations(uid: str):
    docs = (
        _user_ref(uid)
        .collection("conversations")
        .order_by("updated_at", direction=Query.DESCENDING)
        .stream()
    )
    return [_conversation_from_snapshot(doc) for doc in docs]


def rename_conversation(uid: str, conversation_id: str, title: str):
    cleaned_title = _clean_title(title)

    if not cleaned_title:
        raise ValueError("Tên cuộc trò chuyện không được để trống.")

    doc_ref = _conversation_ref(uid, conversation_id)

    if not doc_ref.get().exists:
        return None

    doc_ref.update({
        "title": cleaned_title,
        "updated_at": _now(),
    })
    return _conversation_from_snapshot(doc_ref.get())


def delete_conversation(uid: str, conversation_id: str):
    doc_ref = _conversation_ref(uid, conversation_id)

    if not doc_ref.get().exists:
        return False

    for message in doc_ref.collection("messages").stream():
        message.reference.delete()

    doc_ref.delete()
    return True


def save_message(uid: str, conversation_id: str, role: str, content: str):
    if role not in {"user", "assistant"}:
        raise ValueError("Vai trò tin nhắn không hợp lệ.")

    cleaned_content = content.strip()

    if not cleaned_content:
        raise ValueError("Nội dung tin nhắn không được để trống.")

    doc_ref = _message_collection(uid, conversation_id).document()
    doc_ref.set({
        "role": role,
        "content": cleaned_content,
        "created_at": _now(),
    })
    return _message_from_snapshot(doc_ref.get())


def load_messages(uid: str, conversation_id: str):
    docs = (
        _message_collection(uid, conversation_id)
        .order_by("created_at")
        .stream()
    )
    return [_message_from_snapshot(doc) for doc in docs]


def update_conversation_timestamp(uid: str, conversation_id: str):
    doc_ref = _conversation_ref(uid, conversation_id)

    if not doc_ref.get().exists:
        return None

    doc_ref.update({"updated_at": _now()})
    return _conversation_from_snapshot(doc_ref.get())


def maybe_generate_title_from_first_message(uid: str, conversation_id: str, message: str):
    doc_ref = _conversation_ref(uid, conversation_id)
    snapshot = doc_ref.get()

    if not snapshot.exists:
        return None

    data = snapshot.to_dict() or {}
    title = _clean_title(data.get("title"))
    update_data = {"updated_at": _now()}

    if not title:
        update_data["title"] = _title_from_message(message)

    doc_ref.update(update_data)
    return _conversation_from_snapshot(doc_ref.get())
