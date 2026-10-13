import time
import secrets
from typing import Dict, Any, Optional, Set
from fastapi import WebSocket

# Single-use tickets storage: ticket -> {"user_id": int, "expires_at": float}
_tickets: Dict[str, Dict[str, Any]] = {}

def create_ws_ticket(user_id: int, ttl_seconds: int = 30) -> str:
    """Generates a secure single-use ticket valid for ttl_seconds (default 30s)."""
    clean_expired_tickets()
    ticket = secrets.token_urlsafe(32)
    _tickets[ticket] = {
        "user_id": user_id,
        "expires_at": time.time() + ttl_seconds
    }
    return ticket

def validate_and_consume_ticket(ticket: str) -> Optional[int]:
    """
    Validates a ticket. If valid and not expired, consumes (deletes) it and returns user_id.
    Returns None if ticket is invalid or expired.
    """
    if not ticket:
        return None
    data = _tickets.pop(ticket, None)
    if not data:
        return None
    if time.time() > data["expires_at"]:
        return None
    return data["user_id"]

def clean_expired_tickets():
    """Prunes expired tickets from memory."""
    now = time.time()
    expired = [k for k, v in _tickets.items() if now > v["expires_at"]]
    for k in expired:
        _tickets.pop(k, None)

class ChamberConnectionManager:
    """Manages active WebSockets for chamber live sessions."""
    def __init__(self):
        # user_id -> Set[WebSocket]
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_user(self, user_id: int, event: Dict[str, Any]):
        """Pushes JSON event {type, payload} to all active connections for a given user."""
        if user_id in self.active_connections:
            to_remove = set()
            for ws in list(self.active_connections[user_id]):
                try:
                    await ws.send_json(event)
                except Exception:
                    to_remove.add(ws)
            for ws in to_remove:
                self.disconnect(user_id, ws)

ws_manager = ChamberConnectionManager()
