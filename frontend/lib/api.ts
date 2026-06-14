import { authHeaders, clearAuth, type AuthUser } from "./auth";
import type { Exam, QuestionDraft, StudentSession } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface AuthResponse {
  token: string;
  teacherId: string;
  username: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearAuth();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Please sign in again");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// --- Auth ---

export async function registerTeacher(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return jsonOrThrow(res);
}

export async function loginTeacher(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return jsonOrThrow(res);
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { ...authHeaders() },
  });
  const data = await jsonOrThrow<{ teacherId: string; username: string }>(res);
  return { teacherId: data.teacherId, username: data.username };
}

// --- Exams ---

export async function createExam(input: {
  title: string;
  questions: QuestionDraft[];
}): Promise<Exam> {
  const res = await fetch(`${API_URL}/api/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

export async function listMyExams(): Promise<Exam[]> {
  const res = await fetch(`${API_URL}/api/exams`, {
    headers: { ...authHeaders() },
  });
  return jsonOrThrow(res);
}

export async function getExam(examId: string): Promise<Exam> {
  // Public: students don't have a token but still need to render the quiz.
  const res = await fetch(`${API_URL}/api/exams/${examId}`);
  if (!res.ok) throw new Error("Exam not found");
  return res.json();
}

export async function listExamSessions(
  examId: string
): Promise<StudentSession[]> {
  const res = await fetch(`${API_URL}/api/exams/${examId}/sessions`, {
    headers: { ...authHeaders() },
  });
  return jsonOrThrow(res);
}

export async function deleteExam(examId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/exams/${examId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete exam");
  }
}

// --- Student submit ---

export interface SubmitResult {
  ok: boolean;
  score: number;
  maxScore: number;
  session: StudentSession;
}

export async function submitAnswers(
  sessionId: string,
  answers: { questionId: string; selectedOptionId: string | null }[],
  options?: { tabSwitchTriggered?: boolean }
): Promise<SubmitResult> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers,
      tabSwitchTriggered: !!options?.tabSwitchTriggered,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit");
  }
  return res.json();
}
