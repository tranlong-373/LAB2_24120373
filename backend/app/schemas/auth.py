from pydantic import BaseModel, EmailStr


class EmailPasswordRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshSessionRequest(BaseModel):
    refreshToken: str


class LinkPasswordRequest(BaseModel):
    password: str
