import os
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path

from fastapi import Cookie, FastAPI, HTTPException, Response, status
from fastapi.staticfiles import StaticFiles

from app.ai import (
    AIConfigurationError,
    AIRequestError,
    ask_openrouter,
    ask_openrouter_structured,
)
from app.database import Database, verify_password
from app.schemas import BoardData, ChatRequest, ChatResponse, LoginRequest

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
SESSION_COOKIE = "pm_session"
GUEST_SESSION_LIFETIME = timedelta(hours=1)
database = Database()


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.initialize()
    yield


app = FastAPI(title="Project Management MVP API", version="0.1.0", lifespan=lifespan)


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from the Project Management MVP backend"}


@app.get("/api/health")
def health() -> dict[str, str]:
    with database.connect() as connection:
        connection.execute("SELECT 1").fetchone()
    database.delete_expired_guests()
    return {"status": "ok"}


def authenticated_user(session_id: str | None) -> dict[str, object]:
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = database.get_session_user(session_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return dict(user)


@app.post("/api/auth/login")
def login(credentials: LoginRequest, response: Response) -> dict[str, str]:
    user = database.find_user(credentials.username)
    if user is None or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    response.set_cookie(SESSION_COOKIE, database.create_session(user["id"]), httponly=True, samesite="lax")
    return {"username": user["username"]}


@app.post("/api/auth/guest")
def guest(response: Response) -> dict[str, str]:
    guest = database.create_guest(GUEST_SESSION_LIFETIME)
    response.set_cookie(SESSION_COOKIE, guest["session_id"], httponly=True, samesite="lax")
    return {"username": guest["username"]}


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> None:
    if session_id:
        database.delete_session(session_id)
    response.delete_cookie(SESSION_COOKIE)


@app.get("/api/me")
def me(session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> dict[str, str]:
    user = authenticated_user(session_id)
    return {"username": str(user["username"])}


@app.get("/api/board", response_model=BoardData)
def read_board(session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> dict[str, object]:
    user = authenticated_user(session_id)
    return database.get_board(int(user["id"]))


@app.put("/api/board", response_model=BoardData)
def write_board(
    board: BoardData,
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> BoardData:
    user = authenticated_user(session_id)
    database.save_board(int(user["id"]), board.model_dump())
    return board


@app.post("/api/ai/connectivity")
def ai_connectivity(session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> dict[str, str]:
    authenticated_user(session_id)
    try:
        return {"answer": ask_openrouter("What is 2+2? Reply with only the number.")}
    except AIConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AIRequestError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/ai/chat", response_model=ChatResponse)
def ai_chat(
    request: ChatRequest,
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> ChatResponse:
    user = authenticated_user(session_id)
    if database.count_ai_message(str(session_id)) > int(os.getenv("AI_MESSAGE_LIMIT", "10")):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI message limit reached for this session",
        )
    current_board = database.get_board(int(user["id"]))
    try:
        result = ask_openrouter_structured(
            request.question,
            current_board,
            [message.model_dump() for message in request.history],
        )
        updated_board = BoardData.model_validate(result["board"]) if result.get("board") else None
        if updated_board:
            database.save_board(int(user["id"]), updated_board.model_dump())
        return ChatResponse(response=result["response"], board=updated_board)
    except AIConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AIRequestError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=502, detail="AI returned an invalid board update") from error


# The Docker image copies the frontend export here; on Vercel the frontend is its own service.
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="legacy-static")
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
