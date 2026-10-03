"""
auth.py — JWT-based authentication for SAGE.
Provides:
  - register_user / login_user helpers
  - generate_token / decode_token
  - require_auth  Flask decorator
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from functools import wraps

import bcrypt
import jwt
from flask import request, jsonify, g

log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
def _secret():
    s = os.environ.get("JWT_SECRET", "")
    if not s:
        raise RuntimeError("JWT_SECRET env var not set — authentication cannot work securely.")
    return s

JWT_ALGORITHM  = "HS256"
JWT_EXPIRY_H   = int(os.environ.get("JWT_EXPIRY_HOURS", "24"))


# ── Password helpers ──────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Token helpers ─────────────────────────────────────────────────────────────
def generate_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "sub": str(user_id),   # PyJWT v2+ requires sub to be a string
        "username": username,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_H),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])


def _get_user_id_from_payload(payload: dict) -> int:
    """Convert sub claim back to int regardless of whether it was stored as str or int."""
    return int(payload["sub"])


# ── DB helpers ────────────────────────────────────────────────────────────────
def register_user(username: str, email: str, password: str) -> dict:
    """Create a new user. Raises ValueError on duplicate or bad input."""
    if not username or len(username) < 3:
        raise ValueError("Username must be at least 3 characters.")
    if not email or "@" not in email:
        raise ValueError("Invalid email address.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    from db import get_conn, get_cursor
    password_hash = hash_password(password)

    with get_conn() as conn:
        with get_cursor(conn) as cur:
            # Check uniqueness
            cur.execute(
                "SELECT id FROM users WHERE username=%s OR email=%s",
                (username.lower(), email.lower()),
            )
            if cur.fetchone():
                raise ValueError("Username or email already taken.")

            cur.execute(
                """INSERT INTO users (username, email, password_hash)
                   VALUES (%s, %s, %s) RETURNING id, username, email, role, created_at""",
                (username.lower(), email.lower(), password_hash),
            )
            row = dict(cur.fetchone())
            return row


def login_user(username_or_email: str, password: str) -> dict:
    """Verify credentials. Returns user dict on success, raises ValueError on failure."""
    from db import get_conn, get_cursor
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM users WHERE username=%s OR email=%s",
                (username_or_email.lower(), username_or_email.lower()),
            )
            row = cur.fetchone()

    if not row:
        raise ValueError("Invalid credentials.")
    if not check_password(password, row["password_hash"]):
        raise ValueError("Invalid credentials.")

    # Update last_login (best effort)
    try:
        from db import get_conn as _gc, get_cursor as _cur
        with _gc() as conn2:
            with _cur(conn2) as cur2:
                cur2.execute(
                    "UPDATE users SET last_login=NOW() WHERE id=%s",
                    (row["id"],),
                )
    except Exception:
        pass

    return {
        "id":         row["id"],
        "username":   row["username"],
        "email":      row["email"],
        "role":       row["role"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "last_login": row["last_login"].isoformat() if row.get("last_login") else None,
    }


def get_user_by_id(user_id: int):
    from db import get_conn, get_cursor
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT id, username, email, role, created_at, last_login FROM users WHERE id=%s",
                (user_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id":         row["id"],
        "username":   row["username"],
        "email":      row["email"],
        "role":       row["role"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "last_login": row["last_login"].isoformat() if row.get("last_login") else None,
    }


# ── Flask decorator ───────────────────────────────────────────────────────────
def require_auth(f):
    """Decorator — validates Bearer JWT token. Sets g.user on success."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required.", "code": "UNAUTHORIZED"}), 401
        token = auth_header[7:]
        try:
            payload = decode_token(token)
            g.user = {
                "id":       int(payload["sub"]),   # sub is stored as str in PyJWT v2+
                "username": payload["username"],
                "role":     payload["role"],
            }
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please log in again.", "code": "TOKEN_EXPIRED"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token.", "code": "INVALID_TOKEN"}), 401
        return f(*args, **kwargs)
    return decorated
