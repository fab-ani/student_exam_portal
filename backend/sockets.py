from flask import request
from flask_socketio import join_room

from extensions import db, socketio
from models import Exam, StudentSession


def _teacher_room(exam_id: str) -> str:
    return f"exam_{exam_id}_teachers"


def _student_room(exam_id: str) -> str:
    return f"exam_{exam_id}_students"


# sid -> { examId, role, sessionId? }
_connections: dict[str, dict] = {}


def _any_other_sid_has_session(session_id: str, except_sid: str) -> bool:
    for sid, meta in _connections.items():
        if sid == except_sid:
            continue
        if meta.get("sessionId") == session_id:
            return True
    return False


@socketio.on("connect")
def on_connect():
    _connections[request.sid] = {}


@socketio.on("disconnect")
def on_disconnect():
    meta = _connections.pop(request.sid, None)
    if not meta or meta.get("role") != "student":
        return

    exam_id = meta.get("examId")
    session_id = meta.get("sessionId")
    if not (exam_id and session_id):
        return

    # If another active socket still holds this session (e.g. user reloaded
    # and the new tab joined before the old tab's disconnect arrived), don't
    # announce a disconnect for the same logical student.
    if _any_other_sid_has_session(session_id, request.sid):
        return

    socketio.emit(
        "student-disconnected",
        {"sessionId": session_id},
        room=_teacher_room(exam_id),
    )


@socketio.on("join-exam")
def on_join_exam(payload):
    payload = payload or {}
    role = payload.get("role")
    exam_id = payload.get("examId")
    if role not in ("teacher", "student") or not exam_id:
        return {"ok": False, "error": "invalid payload"}

    exam = db.session.get(Exam, exam_id)
    if not exam:
        return {"ok": False, "error": "exam not found"}

    if role == "teacher":
        join_room(_teacher_room(exam_id))
        _connections[request.sid] = {"role": "teacher", "examId": exam_id}
        sessions = (
            StudentSession.query.filter_by(exam_id=exam_id)
            .order_by(StudentSession.updated_time.desc())
            .all()
        )
        return {
            "ok": True,
            "exam": exam.to_dict(),
            "sessions": [s.to_dict() for s in sessions],
        }

    # Resume path: client sends a sessionId it stashed in sessionStorage.
    resume_id = (payload.get("sessionId") or "").strip()
    if resume_id:
        existing = db.session.get(StudentSession, resume_id)
        if existing and existing.exam_id == exam_id:
            if existing.status == "SUBMITTED":
                return {
                    "ok": False,
                    "error": "session already locked",
                    "locked": True,
                }
            existing.status = "ACTIVE"
            db.session.commit()

            join_room(_student_room(exam_id))
            _connections[request.sid] = {
                "role": "student",
                "examId": exam_id,
                "sessionId": existing.id,
            }
            socketio.emit(
                "live-alert",
                {"sessionId": existing.id, "status": "ACTIVE"},
                room=_teacher_room(exam_id),
            )
            return {
                "ok": True,
                "resumed": True,
                "session": existing.to_dict(),
                "exam": exam.to_dict(),
            }
        # Stored sessionId is unknown to this server (DB reset, wrong exam),
        # fall through and create a fresh session.

    student_name = (payload.get("studentName") or "").strip()
    if not student_name:
        return {"ok": False, "error": "studentName required"}

    session = StudentSession(
        exam_id=exam_id,
        student_name=student_name,
        status="ACTIVE",
    )
    db.session.add(session)
    db.session.commit()

    join_room(_student_room(exam_id))
    _connections[request.sid] = {
        "role": "student",
        "examId": exam_id,
        "sessionId": session.id,
    }

    socketio.emit(
        "student-joined",
        session.to_dict(),
        room=_teacher_room(exam_id),
    )

    return {"ok": True, "session": session.to_dict(), "exam": exam.to_dict()}


@socketio.on("signal-violation-away")
def on_violation_away(payload):
    meta = _connections.get(request.sid) or {}
    if meta.get("role") != "student":
        return
    exam_id = meta.get("examId")
    session_id = meta.get("sessionId")
    if not (exam_id and session_id):
        return

    session = db.session.get(StudentSession, session_id)
    if not session or session.status == "SUBMITTED":
        return

    session.status = "AWAY"
    db.session.commit()

    socketio.emit(
        "live-alert",
        {
            "sessionId": session_id,
            "status": "AWAY",
            "awayStart": (payload or {}).get("awayStart"),
        },
        room=_teacher_room(exam_id),
    )


@socketio.on("signal-violation-return")
def on_violation_return(payload):
    meta = _connections.get(request.sid) or {}
    if meta.get("role") != "student":
        return
    exam_id = meta.get("examId")
    session_id = meta.get("sessionId")
    if not (exam_id and session_id):
        return

    duration = int((payload or {}).get("duration") or 0)
    if duration < 0:
        duration = 0

    session = db.session.get(StudentSession, session_id)
    if not session or session.status == "SUBMITTED":
        return

    session.violation_count = (session.violation_count or 0) + 1
    session.total_time_away = (session.total_time_away or 0) + duration
    session.status = "ACTIVE"
    db.session.commit()

    socketio.emit(
        "live-alert",
        {
            "sessionId": session_id,
            "status": "ACTIVE",
            "lastDuration": duration,
            "violationCount": session.violation_count,
            "totalTimeAway": session.total_time_away,
        },
        room=_teacher_room(exam_id),
    )


@socketio.on("submit-session")
def on_submit_session():
    meta = _connections.get(request.sid) or {}
    if meta.get("role") != "student":
        return
    exam_id = meta.get("examId")
    session_id = meta.get("sessionId")
    if not (exam_id and session_id):
        return

    session = db.session.get(StudentSession, session_id)
    if not session:
        return

    session.status = "SUBMITTED"
    db.session.commit()

    socketio.emit(
        "live-alert",
        {
            "sessionId": session_id,
            "status": "SUBMITTED",
            "violationCount": session.violation_count,
            "totalTimeAway": session.total_time_away,
        },
        room=_teacher_room(exam_id),
    )

    return {"ok": True}
