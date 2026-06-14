import type { StudentSession } from "./types";

// v3: now that the server is authoritative for which exams belong to which
// teacher, localStorage only caches per-exam session snapshots so the
// teacher dashboard renders instantly before the WebSocket connects.

const KEY_PREFIX = "examshield:snapshot:v3:";

interface Snapshot {
  sessions: Record<string, StudentSession>;
  lastUpdated: string;
}

function key(examId: string) {
  return KEY_PREFIX + examId;
}

export function getSnapshot(examId: string): Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(examId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (!parsed.sessions) return null;
    return {
      sessions: parsed.sessions,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function snapshotSessions(
  examId: string,
  sessions: Record<string, StudentSession>
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    key(examId),
    JSON.stringify({
      sessions,
      lastUpdated: new Date().toISOString(),
    })
  );
}

export function removeSnapshot(examId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(examId));
}
