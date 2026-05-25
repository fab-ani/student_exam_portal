export type SessionStatus = "ACTIVE" | "AWAY" | "SUBMITTED";

export interface Exam {
  id: string;
  teacherId: string;
  title: string;
  googleFormUrl: string;
  createdAt: string;
}

export interface StudentSession {
  id: string;
  examId: string;
  studentName: string;
  violationCount: number;
  totalTimeAway: number;
  status: SessionStatus;
  updatedTime: string;
}

export interface LiveAlert {
  sessionId: string;
  status: SessionStatus;
  awayStart?: number;
  lastDuration?: number;
  violationCount?: number;
  totalTimeAway?: number;
}
