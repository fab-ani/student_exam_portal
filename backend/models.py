import uuid
from datetime import datetime, timezone

from extensions import db


def _uuid() -> str:
    return uuid.uuid4().hex[:12]


def _now():
    return datetime.now(timezone.utc)


class Exam(db.Model):
    __tablename__ = "exams"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    teacher_id = db.Column(db.String(64), nullable=False, default="default-teacher")
    title = db.Column(db.String(256), nullable=False)
    google_form_url = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_now, nullable=False)

    sessions = db.relationship(
        "StudentSession", backref="exam", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "teacherId": self.teacher_id,
            "title": self.title,
            "googleFormUrl": self.google_form_url,
            "createdAt": self.created_at.isoformat(),
        }


class StudentSession(db.Model):
    __tablename__ = "student_sessions"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    exam_id = db.Column(
        db.String(32), db.ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    student_name = db.Column(db.String(128), nullable=False)
    violation_count = db.Column(db.Integer, nullable=False, default=0)
    total_time_away = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(16), nullable=False, default="ACTIVE")
    updated_time = db.Column(
        db.DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "examId": self.exam_id,
            "studentName": self.student_name,
            "violationCount": self.violation_count,
            "totalTimeAway": self.total_time_away,
            "status": self.status,
            "updatedTime": self.updated_time.isoformat(),
        }
