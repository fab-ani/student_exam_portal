from flask import Blueprint, jsonify, request

from extensions import db, socketio
from models import Answer, Exam, Question, QuestionOption, StudentSession

api = Blueprint("api", __name__, url_prefix="/api")


@api.get("/health")
def health():
    return jsonify({"ok": True})


@api.post("/exams")
def create_exam():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    teacher_id = (data.get("teacherId") or "default-teacher").strip()
    raw_questions = data.get("questions") or []

    if not title:
        return jsonify({"error": "title is required"}), 400
    if not isinstance(raw_questions, list) or len(raw_questions) == 0:
        return jsonify({"error": "at least one question is required"}), 400

    exam = Exam(title=title, teacher_id=teacher_id)

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

        question = Question(text=q_text, position=q_idx)
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


@api.get("/exams/<exam_id>")
def get_exam(exam_id: str):
    exam = db.session.get(Exam, exam_id)
    if not exam:
        return jsonify({"error": "not found"}), 404
    return jsonify(exam.to_public_dict())


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


@api.delete("/exams/<exam_id>")
def delete_exam(exam_id: str):
    exam = db.session.get(Exam, exam_id)
    if not exam:
        return jsonify({"error": "not found"}), 404
    db.session.delete(exam)
    db.session.commit()
    return jsonify({"ok": True})


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

    # Wipe any previous draft answers for this session before recording the
    # final submission (shouldn't normally happen, but harmless).
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
