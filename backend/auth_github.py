import os
import time
import secrets
import base64
import hashlib
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import httpx
from cryptography.fernet import Fernet
import database

router = APIRouter(tags=["GitHub Auth"])

# --- Token Encryption ---
def _get_fernet() -> Fernet:
    secret = os.getenv("SESSION_SECRET", "nexus_default_super_secret_session_key_32bytes")
    # Derive deterministic 32-byte key from SESSION_SECRET
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)

def encrypt_token(plain_token: str) -> str:
    f = _get_fernet()
    return f.encrypt(plain_token.encode()).decode()

def decrypt_token(enc_token: str) -> str:
    f = _get_fernet()
    return f.decrypt(enc_token.encode()).decode()

# --- In-Memory Rate Limiter (20 requests per minute per IP) ---
_ip_request_timestamps = defaultdict(list)

def check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - 60.0
    
    # Filter timestamps within last 60 seconds
    timestamps = [ts for ts in _ip_request_timestamps[ip] if ts > window_start]
    if len(timestamps) >= 20:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Max 20 requests per minute."
        )
    timestamps.append(now)
    _ip_request_timestamps[ip] = timestamps

# --- Models ---
class MeResponse(BaseModel):
    id: int
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None
    display_name: Optional[str] = None
    total_nxp: int = 0
    current_streak: int = 0
    best_streak: int = 0
    current_chamber: int = 1
    onboarding_complete: bool = False

class LoginUrlResponse(BaseModel):
    url: str

class LogoutResponse(BaseModel):
    message: str

from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/github/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    user = database.get_user_by_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- Endpoints ---
@router.get("/auth/github/login", response_model=LoginUrlResponse, dependencies=[Depends(check_rate_limit)])
def github_login():
    client_id = os.getenv("GITHUB_CLIENT_ID", "")
    redirect_uri = os.getenv("GITHUB_REDIRECT_URI", "")
    if not client_id:
        raise HTTPException(status_code=500, detail="GITHUB_CLIENT_ID is not configured")

    state = secrets.token_hex(24)
    database.save_oauth_state(state)

    from urllib.parse import urlencode
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "public_repo read:user",
        "state": state
    }
    github_auth_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return {"url": github_auth_url}

@router.get("/auth/github/callback", dependencies=[Depends(check_rate_limit)])
async def github_callback(code: Optional[str] = None, state: Optional[str] = None):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    # Verify and single-use consume the state
    is_valid = database.consume_oauth_state(state)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    client_id = os.getenv("GITHUB_CLIENT_ID", "")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    # Exchange code for access token with GitHub
    token_url = "https://github.com/login/oauth/access_token"
    token_payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
    }
    headers = {
        "Accept": "application/json",
        "User-Agent": "Nexus-Code-Awakening/1.0",
    }
    timeout = httpx.Timeout(25.0, connect=15.0)

    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
            token_res = await client.post(token_url, json=token_payload)
            if token_res.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to retrieve GitHub access token")
            token_data = token_res.json()
            access_token = token_data.get("access_token")
            if not access_token:
                error_msg = token_data.get("error_description", "Invalid OAuth code")
                raise HTTPException(status_code=400, detail=error_msg)

            # Fetch GitHub User Profile with automatic retry on transient connection drops
            user_data = None
            for attempt in range(2):
                try:
                    user_res = await client.get(
                        "https://api.github.com/user",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    if user_res.status_code == 200:
                        user_data = user_res.json()
                        break
                    else:
                        raise HTTPException(status_code=400, detail="Failed to fetch GitHub profile")
                except (httpx.ConnectTimeout, httpx.ConnectError):
                    if attempt == 1:
                        raise
            if not user_data:
                raise HTTPException(status_code=400, detail="Failed to fetch GitHub profile")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="GitHub connection timed out. Please retry authentication.")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Network error communicating with GitHub: {str(exc)}")

    github_id = str(user_data["id"])
    github_username = user_data.get("login")
    avatar_url = user_data.get("avatar_url")
    display_name = user_data.get("name") or github_username
    email = user_data.get("email")

    # Encrypt GitHub access token before saving
    github_token_enc = encrypt_token(access_token)

    # Upsert user in database and guarantee player_profile row
    user = database.upsert_github_user(
        github_id=github_id,
        github_username=github_username,
        avatar_url=avatar_url,
        github_token_enc=github_token_enc,
        email=email,
        display_name=display_name
    )

    # Create session
    session_token = secrets.token_hex(32)
    database.create_session(user["id"], session_token)

    # Redirect to FRONTEND_URL/auth/callback#token=<session_token>
    redirect_target = f"{frontend_url}/auth/callback#token={session_token}"
    return RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)

@router.post("/auth/logout", response_model=LogoutResponse)
def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        database.delete_session(token)
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=MeResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    user_me = database.get_user_me(current_user["id"])
    if not user_me:
        raise HTTPException(status_code=404, detail="Cadet profile not found")
    return user_me
