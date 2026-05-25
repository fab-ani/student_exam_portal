from urllib.parse import urlparse

from flask import Blueprint, jsonify, request

from extensions import db
from models import Exam, StudentSession

api = Blueprint("api", __name__, url_prefix="/api")


def _is_valid_google_form_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.netloc or "").lower()
    return "docs.google.com" in host or "forms.gle" in host


@api.get("/health")
def health():
    return jsonify({"ok": True})


@api.post("/exams")
def create_exam():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    google_form_url = (data.get("googleFormUrl") or "").strip()
    teacher_id = (data.get("teacherId") or "default-teacher").strip()

    if not title:
        return jsonify({"error": "title is required"}), 400
    if not google_form_url:
        return jsonify({"error": "googleFormUrl is required"}), 400
    if not _is_valid_google_form_url(google_form_url):
        return jsonify({"error": "URL must be a Google Forms link"}), 400

    exam = Exam(
        title=title,
        google_form_url=google_form_url,
        teacher_id=teacher_id,
    )
    db.session.add(exam)
    db.session.commit()

    return jsonify(exam.to_dict()), 201


@api.get("/exams/<exam_id>")
def get_exam(exam_id: str):
    exam = db.session.get(Exam, exam_id)
    if not exam:
        return jsonify({"error": "not found"}), 404
    return jsonify(exam.to_dict())


@api.get("/exams/<exam_id>/sessions")
def list_sessions(exam_id: str):
    exam = db.session.get(Exam, exam_id)
    if not exam:
        return jsonify({"error": "not found"}), 404
    sessions = (
        StudentSession.query.filter_by(exam_id=exam_id)
        .order_by(StudentSession.updated_time.desc())
        .all()
    )
    return jsonify([s.to_dict() for s in sessions])
