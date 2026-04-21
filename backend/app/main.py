from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers.auth import router as auth_router
from backend.app.routers.conversations import router as conversations_router
from backend.app.services.chatbot_service import chatbot_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    chatbot_service.preload_in_background()
    yield


app = FastAPI(title="Lab2 Chatbot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(conversations_router)

@app.get("/")
def root():
    return {
        "message": "Lab2 Chatbot API is running",
        "model": chatbot_service.get_model_name(),
        "endpoints": [
            "/",
            "/health",
            "/auth/me",
            "/conversations",
        ],
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": chatbot_service.get_model_name(),
        "loaded": chatbot_service.is_ready(),
        "loading": chatbot_service.is_loading(),
        "error": chatbot_service.get_load_error(),
    }
