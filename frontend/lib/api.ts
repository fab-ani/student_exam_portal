import type { Exam } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function createExam(input: {
  title: string;
  googleFormUrl: string;
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
