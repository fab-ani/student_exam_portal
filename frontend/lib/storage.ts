import type { StudentSession } from "./types";

// v2: dropped googleFormUrl from the stored shape after the native-quiz rewrite.
const KEY = "examshield:teacher:exams:v2";

export interface StoredExam {
  id: string;
  title: string;
  portalUrl: string;
  teacherUrl: string;
  createdAt: string;
  questionCount: number;
  sessions: Record<string, StudentSession>;
  lastUpdated: string;
}

function read(): StoredExam[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(exams: StoredExam[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(exams));
}

export function getStoredExams(): StoredExam[] {
  return read();
}

export function getStoredExam(examId: string): StoredExam | null {
  return read().find((e) => e.id === examId) || null;
}

export function upsertStoredExam(
  exam: Omit<StoredExam, "sessions" | "lastUpdated"> &
    Partial<Pick<StoredExam, "sessions" | "lastUpdated">>
) {
  const exams = read();
  const idx = exams.findIndex((e) => e.id === exam.id);
  const merged: StoredExam = {
    ...exam,
    sessions: exam.sessions || exams[idx]?.sessions || {},
    lastUpdated:
      exam.lastUpdated ||
      exams[idx]?.lastUpdated ||
      new Date().toISOString(),
  };
  if (idx >= 0) exams[idx] = merged;
  else exams.unshift(merged);
  write(exams);
}

export function snapshotSessions(
  examId: string,
  sessions: Record<string, StudentSession>
) {
  const exams = read();
  const idx = exams.findIndex((e) => e.id === examId);
  if (idx < 0) return;
  exams[idx] = {
    ...exams[idx],
    sessions,
    lastUpdated: new Date().toISOString(),
  };
  write(exams);
}

export function removeStoredExam(examId: string) {
  write(read().filter((e) => e.id !== examId));
}
