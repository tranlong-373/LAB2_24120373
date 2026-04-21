from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.dependencies.auth import get_current_user
from backend.app.schemas.conversation import (
    ChatRequest,
    ConversationChatResponse,
    ConversationCreate,
    ConversationItem,
    ConversationRename,
    MessageItem,
)
from backend.app.services import firestore_service
from backend.app.services.chatbot_service import generate

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _uid(user) -> str:
    return user["uid"]


def _require_conversation(uid: str, conversation_id: str):
    conversation = firestore_service.get_conversation(uid, conversation_id)

    if conversation is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")

    return conversation


@router.get("", response_model=list[ConversationItem])
def get_conversations(user=Depends(get_current_user)):
    return firestore_service.list_conversations(_uid(user))


@router.post("", response_model=ConversationItem, status_code=status.HTTP_201_CREATED)
def post_conversation(
    request: ConversationCreate | None = None,
    user=Depends(get_current_user),
):
    return firestore_service.create_conversation(_uid(user), request.title if request else None)


@router.patch("/{conversation_id}", response_model=ConversationItem)
def patch_conversation(
    conversation_id: str,
    request: ConversationRename,
    user=Depends(get_current_user),
):
    try:
        conversation = firestore_service.rename_conversation(
            _uid(user),
            conversation_id,
            request.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if conversation is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")

    return conversation


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_conversation(conversation_id: str, user=Depends(get_current_user)):
    deleted = firestore_service.delete_conversation(_uid(user), conversation_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")

    return None


@router.get("/{conversation_id}/messages", response_model=list[MessageItem])
def get_conversation_messages(conversation_id: str, user=Depends(get_current_user)):
    uid = _uid(user)
    _require_conversation(uid, conversation_id)
    return firestore_service.load_messages(uid, conversation_id)


@router.post("/{conversation_id}/chat", response_model=ConversationChatResponse)
def post_conversation_chat(
    conversation_id: str,
    request: ChatRequest,
    user=Depends(get_current_user),
):
    uid = _uid(user)
    _require_conversation(uid, conversation_id)

    message = request.message.strip()

    if not message:
        raise HTTPException(status_code=400, detail="'message' không được để trống.")

    try:
        firestore_service.save_message(uid, conversation_id, "user", message)
        reply = generate(message)
        firestore_service.save_message(uid, conversation_id, "assistant", reply)
        conversation = firestore_service.maybe_generate_title_from_first_message(
            uid,
            conversation_id,
            message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi sinh câu trả lời từ chatbot: {exc}",
        ) from exc

    if conversation is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")

    return {
        "reply": reply,
        "conversation": conversation,
        "messages": firestore_service.load_messages(uid, conversation_id),
    }
