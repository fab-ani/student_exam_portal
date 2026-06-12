"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Socket } from "socket.io-client";

import ExamFrame from "@/components/ExamFrame";
import StudentOnboarding from "@/components/StudentOnboarding";
import { getExam } from "@/lib/api";
import { disconnectSocket, getSocket } from "@/lib/socket";
import type { Exam, StudentSession } from "@/lib/types";

type Phase = "loading" | "onboarding" | "exam" | "finished" | "error";

const storageKey = (examId: string) => `examshield:portal:${examId}`;

interface StoredSession {
  sessionId: string;
  studentName: string;
}

function readStored(examId: string): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(examId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.sessionId || !parsed.studentName) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function writeStored(examId: string, value: StoredSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(storageKey(examId), JSON.stringify(value));
}

function clearStored(examId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey(examId));
}

interface JoinResponse {
  ok: boolean;
  resumed?: boolean;
  locked?: boolean;
  session?: StudentSession;
  exam?: Exam;
  error?: string;
}

function emitJoin(
  sock: Socket,
  payload: Record<string, unknown>
): Promise<JoinResponse> {
  return new Promise((resolve) => {
    const proceed = () => {
      sock.emit("join-exam", payload, (res: JoinResponse) => resolve(res));
    };
    if (sock.connected) proceed();
    else sock.once("connect", proceed);
  });
}

export default function StudentPortalPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<StudentSession | null>(null);
  const [studentName, setStudentName] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<{
    score: number;
    maxScore: number;
  } | null>(null);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    (async () => {
      let loadedExam: Exam;
      try {
        loadedExam = await getExam(examId);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Exam not found");
        setPhase("error");
        return;
      }
      if (cancelled) return;
      setExam(loadedExam);

      const stored = readStored(examId);
      if (stored) {
        const sock = getSocket();
        const res = await emitJoin(sock, {
          role: "student",
          examId,
          sessionId: stored.sessionId,
        });
        if (cancelled) return;

        if (res.ok && res.session) {
          setStudentName(res.session.studentName || stored.studentName);
          setSession(res.session);
          if (res.exam) setExam(res.exam);
          setSocket(sock);
          setPhase("exam");
          return;
        }
        if (res.locked) {
          clearStored(examId);
          setPhase("finished");
          return;
        }
        clearStored(examId);
      }

      setPhase("onboarding");
    })();

    return () => {
      cancelled = true;
    };
  }, [examId]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  async function handleJoin(name: string) {
    const sock = getSocket();
    const res = await emitJoin(sock, {
      role: "student",
      examId,
      studentName: name,
    });
    if (!res.ok || !res.session) {
      throw new Error(res.error || "Failed to join");
    }
    writeStored(examId, {
      sessionId: res.session.id,
      studentName: name,
    });
    setStudentName(name);
    setSession(res.session);
    if (res.exam) setExam(res.exam);
    setSocket(sock);
    setPhase("exam");
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 text-gray-500">
        Loading exam…
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 sm:px-6 py-4 text-gray-700 break-words max-w-md">
          {error || "Something went wrong"}
        </div>
      </main>
    );
  }

  if (phase === "onboarding" && exam) {
    return <StudentOnboarding examTitle={exam.title} onJoin={handleJoin} />;
  }

  if (phase === "exam" && exam && socket && session && exam.questions) {
    return (
      <ExamFrame
        socket={socket}
        sessionId={session.id}
        studentName={studentName}
        examTitle={exam.title}
        questions={exam.questions}
        onFinished={(result) => {
          setFinalResult(result);
          setPhase("finished");
        }}
      />
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="text-center max-w-md">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Exam submitted.
        </h1>
        {finalResult && (
          <div className="mt-4 inline-block bg-green-50 border border-green-200 rounded-xl px-5 py-3">
            <div className="text-xs uppercase tracking-wider text-green-700 mb-1">
              Your score
            </div>
            <div className="text-3xl font-bold text-green-700 tabular-nums">
              {finalResult.score}
              <span className="text-green-600/60"> / {finalResult.maxScore}</span>
            </div>
          </div>
        )}
        <p className="text-sm sm:text-base text-gray-500 mt-4">
          You can safely close this tab.
        </p>
      </div>
    </main>
  );
}
