from typing import Literal

from pydantic import BaseModel

from backend.app.schemas.chat import ChatRequest


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationRename(BaseModel):
    title: str


class ConversationItem(BaseModel):
    id: str
    title: str
    created_at: str | None = None
    updated_at: str | None = None


class MessageItem(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str | None = None


class ConversationChatResponse(BaseModel):
    reply: str
    conversation: ConversationItem
    messages: list[MessageItem]


__all__ = [
    "ChatRequest",
    "ConversationChatResponse",
    "ConversationCreate",
    "ConversationItem",
    "ConversationRename",
    "MessageItem",
]
