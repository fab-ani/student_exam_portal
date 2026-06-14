from flask import Blueprint, g, jsonify, request

from auth import (
    hash_password,
    issue_token,
    require_teacher,
    verify_password,
)
from extensions import db, socketio
from models import Answer, Exam, Question, QuestionOption, StudentSession, Teacher

api = Blueprint("api", __name__, url_prefix="/api")
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# --- Health ---


@api.get("/health")
def health():
    return jsonify({"ok": True})


# --- Auth ---


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""
    if len(username) < 3:
        return jsonify({"error": "username must be at least 3 characters"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400

    if Teacher.query.filter_by(username=username).first():
        return jsonify({"error": "username already taken"}), 409

    teacher = Teacher(username=username, password_hash=hash_password(password))
    db.session.add(teacher)
    db.session.commit()

    return (
        jsonify(
            {
                "token": issue_token(teacher.id),
                "teacherId": teacher.id,
                "username": teacher.username,
            }
        ),
        201,
    )


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    teacher = Teacher.query.filter_by(username=username).first()
    if not teacher or not verify_password(teacher.password_hash, password):
        return jsonify({"error": "invalid username or password"}), 401

    return jsonify(
        {
            "token": issue_token(teacher.id),
            "teacherId": teacher.id,
            "username": teacher.username,
        }
    )


@auth_bp.get("/me")
@require_teacher
def me():
    return jsonify({"teacherId": g.teacher.id, "username": g.teacher.username})


# --- Exams (mostly teacher-scoped) ---


@api.post("/exams")
@require_teacher
def create_exam():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    raw_questions = data.get("questions") or []

    if not title:
        return jsonify({"error": "title is required"}), 400
    if not isinstance(raw_questions, list) or len(raw_questions) == 0:
        return jsonify({"error": "at least one question is required"}), 400

    exam = Exam(title=title, teacher_id=g.teacher.id)

    for q_idx, raw_q in enumerate(raw_questions):
        q_text = (raw_q.get("text") or "").strip()
        raw_options = raw_q.get("options") or []
        if not q_text:
            return jsonify({"error": f"question {q_idx + 1} text is required"}), 400
        if not isinstance(raw_options, list) or len(raw_options) < 2:
            return (
                jsonify({"error": f"question {q_idx + 1} needs at least 2 options"}),
                400,
            )

        correct_count = sum(1 for o in raw_options if o.get("isCorrect"))
        if correct_count != 1:
            return (
                jsonify(
                    {
                        "error": (
                            f"question {q_idx + 1} must have exactly one correct option"
                        )
                    }
                ),
                400,
            )

        try:
            time_limit = int(raw_q.get("timeLimitSeconds") or 30)
        except (TypeError, ValueError):
            return (
                jsonify(
                    {"error": f"question {q_idx + 1} timeLimitSeconds must be a number"}
                ),
                400,
            )
        time_limit = max(5, min(3600, time_limit))

        question = Question(
            text=q_text, position=q_idx, time_limit_seconds=time_limit
        )
        for o_idx, raw_o in enumerate(raw_options):
            opt_text = (raw_o.get("text") or "").strip()
            if not opt_text:
                return (
                    jsonify(
                        {
                            "error": (
                                f"question {q_idx + 1} option {o_idx + 1} text is required"
                            )
                        }
                    ),
                    400,
                )
            question.options.append(
                QuestionOption(
                    text=opt_text,
                    position=o_idx,
                    is_correct=bool(raw_o.get("isCorrect")),
                )
            )
        exam.questions.append(question)

    db.session.add(exam)
    db.session.commit()

    return jsonify(exam.to_public_dict()), 201


@api.get("/exams")
@require_teacher
def list_my_exams():
    exams = (
        Exam.query.filter_by(teacher_id=g.teacher.id)
        .order_by(Exam.created_at.desc())
        .all()
    )
    return jsonify([e.to_summary_dict() for e in exams])


@api.get("/exams/<exam_id>")
def get_exam(exam_id: str):
    """Public: students need this to render the quiz. No is_correct leaked."""
    exam = db.session.get(Exam, exam_id)
    if not exam:
        return jsonify({"error": "not found"}), 404
    return jsonify(exam.to_public_dict())


@api.get("/exams/<exam_id>/sessions")
@require_teacher
def list_sessions(exam_id: str):
    exam = db.session.get(Exam, exam_id)
    if not exam or exam.teacher_id != g.teacher.id:
        return jsonify({"error": "not found"}), 404
    sessions = (
        StudentSession.query.filter_by(exam_id=exam_id)
        .order_by(StudentSession.updated_time.desc())
        .all()
    )
    return jsonify([s.to_dict() for s in sessions])


@api.delete("/exams/<exam_id>")
@require_teacher
def delete_exam(exam_id: str):
    exam = db.session.get(Exam, exam_id)
    if not exam or exam.teacher_id != g.teacher.id:
        return jsonify({"error": "not found"}), 404
    db.session.delete(exam)
    db.session.commit()
    return jsonify({"ok": True})


# --- Student submit (no auth: students aren't logged in) ---


def _teacher_room(exam_id: str) -> str:
    return f"exam_{exam_id}_teachers"


@api.post("/sessions/<session_id>/submit")
def submit_answers(session_id: str):
    session = db.session.get(StudentSession, session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404
    if session.status == "SUBMITTED":
        return jsonify({"error": "already submitted"}), 409

    data = request.get_json(silent=True) or {}
    raw_answers = data.get("answers") or []
    tab_switch_triggered = bool(data.get("tabSwitchTriggered"))
    answers_by_question = {
        (a.get("questionId") or ""): (a.get("selectedOptionId") or None)
        for a in raw_answers
        if a.get("questionId")
    }

    questions = (
        Question.query.filter_by(exam_id=session.exam_id)
        .order_by(Question.position)
        .all()
    )

    Answer.query.filter_by(session_id=session.id).delete()

    score = 0
    for q in questions:
        selected_id = answers_by_question.get(q.id)
        db.session.add(
            Answer(
                session_id=session.id,
                question_id=q.id,
                selected_option_id=selected_id,
            )
        )
        if selected_id and selected_id == q.correct_option_id:
            score += 1

    from datetime import datetime, timezone

    if tab_switch_triggered:
        session.violation_count = (session.violation_count or 0) + 1

    session.score = score
    session.max_score = len(questions)
    session.status = "SUBMITTED"
    session.submitted_at = datetime.now(timezone.utc)
    db.session.commit()

    socketio.emit(
        "live-alert",
        {
            "sessionId": session.id,
            "status": "SUBMITTED",
            "violationCount": session.violation_count,
            "totalTimeAway": session.total_time_away,
            "score": session.score,
            "maxScore": session.max_score,
        },
        room=_teacher_room(session.exam_id),
    )

    return jsonify(
        {
            "ok": True,
            "score": session.score,
            "maxScore": session.max_score,
            "session": session.to_dict(),
        }
    )
