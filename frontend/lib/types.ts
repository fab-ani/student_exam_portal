export type SessionStatus = "ACTIVE" | "AWAY" | "SUBMITTED";

export interface QuestionOption {
  id: string;
  text: string;
  position: number;
}

export interface Question {
  id: string;
  text: string;
  position: number;
  options: QuestionOption[];
}

export interface Exam {
  id: string;
  title: string;
  createdAt: string;
  questions?: Question[];
  questionCount?: number;
}

export interface StudentSession {
  id: string;
  examId: string;
  studentName: string;
  violationCount: number;
  totalTimeAway: number;
  status: SessionStatus;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  updatedTime: string;
}

export interface LiveAlert {
  sessionId: string;
  status: SessionStatus;
  awayStart?: number;
  lastDuration?: number;
  violationCount?: number;
  totalTimeAway?: number;
  score?: number;
  maxScore?: number;
}

export interface QuestionDraft {
  text: string;
  options: { text: string; isCorrect: boolean }[];
}
