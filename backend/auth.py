from functools import wraps

from flask import g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from extensions import db
from models import Teacher

_serializer = URLSafeTimedSerializer(Config.SECRET_KEY, salt="examshield-auth")
TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60  # 30 days


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    return check_password_hash(stored_hash, password)


def issue_token(teacher_id: str) -> str:
    return _serializer.dumps(teacher_id)


def verify_token(token: str):
    if not token:
        return None
    try:
        return _serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None


def _token_from_headers() -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return ""
    return auth[7:].strip()


def get_teacher_from_request():
    teacher_id = verify_token(_token_from_headers())
    if not teacher_id:
        return None
    return db.session.get(Teacher, teacher_id)


def require_teacher(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        teacher = get_teacher_from_request()
        if not teacher:
            return jsonify({"error": "unauthorized"}), 401
        g.teacher = teacher
        return view(*args, **kwargs)

    return wrapper
