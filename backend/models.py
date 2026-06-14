import uuid
from datetime import datetime, timezone

from extensions import db


def _uuid() -> str:
    return uuid.uuid4().hex[:12]


def _now():
    return datetime.now(timezone.utc)


class Teacher(db.Model):
    __tablename__ = "teachers"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_now, nullable=False)

    exams = db.relationship("Exam", backref="teacher", cascade="all, delete-orphan")


class Exam(db.Model):
    __tablename__ = "exams"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    teacher_id = db.Column(
        db.String(32),
        db.ForeignKey("teachers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_now, nullable=False)

    questions = db.relationship(
        "Question",
        backref="exam",
        cascade="all, delete-orphan",
        order_by="Question.position",
    )
    sessions = db.relationship(
        "StudentSession", backref="exam", cascade="all, delete-orphan"
    )

    def to_public_dict(self):
        """Shape sent to students — no is_correct flags leaked."""
        return {
            "id": self.id,
            "title": self.title,
            "createdAt": self.created_at.isoformat(),
            "questions": [
                {
                    "id": q.id,
                    "text": q.text,
                    "position": q.position,
                    "timeLimitSeconds": q.time_limit_seconds,
                    "options": [
                        {"id": o.id, "text": o.text, "position": o.position}
                        for o in q.options
                    ],
                }
                for q in self.questions
            ],
        }

    def to_summary_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "createdAt": self.created_at.isoformat(),
            "questionCount": len(self.questions),
        }


class Question(db.Model):
    __tablename__ = "questions"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    exam_id = db.Column(
        db.String(32), db.ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    text = db.Column(db.Text, nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    time_limit_seconds = db.Column(db.Integer, nullable=False, default=30)

    options = db.relationship(
        "QuestionOption",
        backref="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.position",
    )

    @property
    def correct_option_id(self):
        for o in self.options:
            if o.is_correct:
                return o.id
        return None


class QuestionOption(db.Model):
    __tablename__ = "question_options"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    question_id = db.Column(
        db.String(32),
        db.ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    text = db.Column(db.Text, nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    is_correct = db.Column(db.Boolean, nullable=False, default=False)


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
    score = db.Column(db.Integer, nullable=True)
    max_score = db.Column(db.Integer, nullable=True)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    updated_time = db.Column(
        db.DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    answers = db.relationship(
        "Answer", backref="session", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "examId": self.exam_id,
            "studentName": self.student_name,
            "violationCount": self.violation_count,
            "totalTimeAway": self.total_time_away,
            "status": self.status,
            "score": self.score,
            "maxScore": self.max_score,
            "submittedAt": self.submitted_at.isoformat() if self.submitted_at else None,
            "updatedTime": self.updated_time.isoformat(),
        }


class Answer(db.Model):
    __tablename__ = "answers"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    session_id = db.Column(
        db.String(32),
        db.ForeignKey("student_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id = db.Column(
        db.String(32),
        db.ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    selected_option_id = db.Column(
        db.String(32),
        db.ForeignKey("question_options.id", ondelete="SET NULL"),
        nullable=True,
    )
