import type { Exam, QuestionDraft, StudentSession } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function createExam(input: {
  title: string;
  questions: QuestionDraft[];
  teacherId?: string;
}): Promise<Exam> {
  const res = await fetch(`${API_URL}/api/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create exam");
  }
  return res.json();
}

export async function getExam(examId: string): Promise<Exam> {
  const res = await fetch(`${API_URL}/api/exams/${examId}`);
  if (!res.ok) throw new Error("Exam not found");
  return res.json();
}

export async function deleteExam(examId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/exams/${examId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete exam");
  }
}

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
