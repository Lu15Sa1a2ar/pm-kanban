import logging
import os
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.ai import AIConfigurationError, AIRequestError, ask_openrouter_structured
from app.database import Database, verify_password
from app.schemas import BoardData, ChatRequest, ChatResponse, LoginRequest

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
SESSION_COOKIE = "pm_session"
GUEST_SESSION_LIFETIME = timedelta(hours=1)
database = Database()
logger = logging.getLogger(__name__)


def is_production() -> bool:
    return os.getenv("PRODUCTION") == "1" or os.getenv("VERCEL_ENV") == "production"


def env_int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.initialize(seed_user=not is_production())
    yield


def api_docs_urls() -> dict[str, str | None]:
    """The interactive docs are for local development only."""
    hidden = is_production()
    return {
        "docs_url": None if hidden else "/docs",
        "redoc_url": None if hidden else "/redoc",
        "openapi_url": None if hidden else "/openapi.json",
    }


app = FastAPI(
    title="Project Management MVP API", version="0.1.0", lifespan=lifespan, **api_docs_urls()
)


# Same values as the `headers` block in vercel.json, so the Docker deployment matches
# production. `script-src 'unsafe-inline'` is required by the Next.js static export.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; "
    "font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
SECURITY_HEADERS = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def security_headers_and_same_site_writes(request: Request, call_next):
    # Browsers send Sec-Fetch-Site on every request; a cross-site value on a write is a
    # CSRF attempt that SameSite=Lax and the JSON body already stop. Made explicit here.
    fetch_site = request.headers.get("sec-fetch-site")
    if request.method not in SAFE_METHODS and fetch_site not in (None, "same-origin", "none"):
        return Response("Cross-site request rejected", status_code=status.HTTP_403_FORBIDDEN)
    # Oversized declared bodies are refused before a byte of them is read.
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > env_int("MAX_BOARD_BYTES", 256 * 1024):
        return JSONResponse({"detail": "Request is too large"}, status_code=status.HTTP_413_CONTENT_TOO_LARGE)
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    if is_production():
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "private, no-store"
    return response


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from the Project Management MVP backend"}


@app.get("/api/health")
def health(authorization: str | None = Header(default=None)) -> dict[str, str]:
    """Keeps the database active; the cleanup only runs for the Vercel cron (CRON_SECRET)."""
    with database.connect() as connection:
        connection.execute("SELECT 1").fetchone()
    if authorization is not None:
        require_operator(authorization)
        database.delete_expired_guests()
    return {"status": "ok"}


def require_operator(authorization: str | None) -> None:
    secret = os.getenv("CRON_SECRET")
    if not secret or authorization != f"Bearer {secret}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


@app.get("/api/stats")
def stats(authorization: str | None = Header(default=None)) -> dict[str, object]:
    """Demo starts (every click on "Try the demo") for the operator; CRON_SECRET as bearer."""
    require_operator(authorization)
    return database.demo_stats()


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, session_id, httponly=True, secure=is_production(), samesite="lax", path="/"
    )


def client_ip(request: Request) -> str:
    """The per-IP quotas key on this. Only the proxy header Vercel sets is trusted: in
    Docker the client talks to Uvicorn directly and could pick any X-Forwarded-For value."""
    if os.getenv("VERCEL"):
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


async def limit_body_size(request: Request) -> None:
    """Chunked bodies carry no Content-Length, so they are measured after the read. Declared
    lengths are rejected earlier, in the middleware: FastAPI reads the body before it
    resolves dependencies, so a check here could never prevent the read."""
    if len(await request.body()) > env_int("MAX_BOARD_BYTES", 256 * 1024):
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Request is too large")


def authenticated_user(session_id: str | None) -> dict[str, object]:
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = database.get_session_user(session_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return dict(user)


@app.post("/api/auth/login")
def login(credentials: LoginRequest, request: Request, response: Response) -> dict[str, str]:
    # Failed attempts share the guest window: GUEST_RATE_LIMIT failures per IP per hour.
    ip = client_ip(request)
    if database.count_signups(f"login:{ip}") >= env_int("GUEST_RATE_LIMIT", 5):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts, try later")
    user = database.find_user(credentials.username)
    if user is None or not verify_password(credentials.password, user["password_hash"]):
        database.record_signup(f"login:{ip}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    set_session_cookie(response, database.create_session(user["id"]))
    return {"username": user["username"]}


@app.post("/api/auth/guest")
def guest(
    request: Request,
    response: Response,
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict[str, str]:
    current = database.get_session_user(session_id) if session_id else None
    if current is not None:
        database.record_demo_start("existing")
        return {"username": str(current["username"])}
    guest = database.create_guest(
        GUEST_SESSION_LIFETIME, client_ip(request), env_int("GUEST_RATE_LIMIT", 5)
    )
    if guest is None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many demo sessions, try later"
        )
    set_session_cookie(response, guest["session_id"])
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


@app.put("/api/board", response_model=BoardData, dependencies=[Depends(limit_body_size)])
def write_board(
    board: BoardData,
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> BoardData:
    user = authenticated_user(session_id)
    database.save_board(int(user["id"]), board.model_dump())
    return board


def ai_error(error: Exception) -> HTTPException:
    logger.warning("AI request failed", exc_info=error)
    if isinstance(error, AIConfigurationError):
        return HTTPException(status_code=503, detail="AI assistant is not configured")
    return HTTPException(status_code=502, detail="AI assistant request failed")


@app.post("/api/ai/chat", response_model=ChatResponse, dependencies=[Depends(limit_body_size)])
def ai_chat(
    request: ChatRequest,
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> ChatResponse:
    user = authenticated_user(session_id)
    session_count, daily_count = database.count_ai_message(str(session_id))
    if session_count > env_int("AI_MESSAGE_LIMIT", 10):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="ai_session_limit")
    if daily_count > env_int("AI_DAILY_LIMIT", 200):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="ai_daily_limit")
    current_board = database.get_board(int(user["id"]))
    try:
        result = ask_openrouter_structured(
            request.question,
            current_board,
            [message.model_dump() for message in request.history],
        )
        updated_board = BoardData.model_validate(result["board"]) if result.get("board") else None
        if updated_board:
            # The model may rename columns and move cards, never add or remove columns.
            if [c.id for c in updated_board.columns] != [c["id"] for c in current_board["columns"]]:
                raise ValueError("AI changed the column set")
            # A wholesale rewrite that drops cards is more likely an injection or a model
            # slip than a request; the prompt only allows deletions the question asked for.
            removed = set(current_board["cards"]) - set(updated_board.cards)
            if len(removed) > env_int("MAX_AI_DELETIONS", 3):
                raise ValueError(f"AI removed {len(removed)} cards")
            database.save_board(int(user["id"]), updated_board.model_dump())
        return ChatResponse(response=result["response"], board=updated_board)
    except (AIConfigurationError, AIRequestError) as error:
        raise ai_error(error) from error
    except ValueError as error:
        logger.warning("AI returned an invalid board update", exc_info=error)
        raise HTTPException(status_code=502, detail="AI returned an invalid board update") from error


def mount_frontend(app: FastAPI, directory: Path) -> None:
    """The Docker image copies the frontend export here; on Vercel the frontend is its own service."""
    if directory.is_dir():
        app.mount("/static", StaticFiles(directory=directory), name="legacy-static")
        app.mount("/", StaticFiles(directory=directory, html=True), name="frontend")


mount_frontend(app, STATIC_DIR)
