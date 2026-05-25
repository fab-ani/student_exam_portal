"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import StudentRow from "@/components/StudentRow";
import { deleteExam } from "@/lib/api";
import { downloadExamPdf } from "@/lib/pdf";
import { getSocket } from "@/lib/socket";
import {
  getStoredExam,
  removeStoredExam,
  snapshotSessions,
  upsertStoredExam,
} from "@/lib/storage";
import type { Exam, LiveAlert, StudentSession } from "@/lib/types";

export default function TeacherDashboardPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const examId = params.examId;

  const [exam, setExam] = useState<Exam | null>(null);
  const [sessions, setSessions] = useState<Record<string, StudentSession>>({});
  const [awayStarts, setAwayStarts] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const joinedRef = useRef(false);

  // Hydrate from localStorage cache so the dashboard shows the last known
  // state immediately, even before the WebSocket join completes.
  useEffect(() => {
    if (!examId) return;
    const cached = getStoredExam(examId);
    if (cached) {
      setExam({
        id: cached.id,
        title: cached.title,
        googleFormUrl: cached.googleFormUrl,
        teacherId: "",
        createdAt: cached.createdAt,
      });
      if (cached.sessions) setSessions(cached.sessions);
    }
  }, [examId]);

  // Persist every change so navigating away doesn't lose the snapshot.
  useEffect(() => {
    if (!examId || !exam) return;
    snapshotSessions(examId, sessions);
  }, [examId, exam, sessions]);

  useEffect(() => {
    if (!examId) return;
    const socket = getSocket();

    const handleConnect = () => {
      setConnected(true);
      if (joinedRef.current) return;
      joinedRef.current = true;

      socket.emit(
        "join-exam",
        { role: "teacher", examId },
        (res: {
          ok: boolean;
          exam?: Exam;
          sessions?: StudentSession[];
          error?: string;
        }) => {
          if (!res?.ok) {
            setError(res?.error || "Failed to join exam");
            return;
          }
          if (res.exam) {
            setExam(res.exam);
            const origin =
              typeof window !== "undefined" ? window.location.origin : "";
            upsertStoredExam({
              id: res.exam.id,
              title: res.exam.title,
              googleFormUrl: res.exam.googleFormUrl,
              portalUrl: `${origin}/portal/${res.exam.id}`,
              teacherUrl: `${origin}/teacher/${res.exam.id}`,
              createdAt: res.exam.createdAt,
            });
          }
          if (res.sessions) {
            const map: Record<string, StudentSession> = {};
            for (const s of res.sessions) map[s.id] = s;
            setSessions(map);
          }
        }
      );
    };

    const handleDisconnect = () => setConnected(false);

    const handleStudentJoined = (s: StudentSession) => {
      setSessions((prev) => ({ ...prev, [s.id]: s }));
    };

    const handleLiveAlert = (alert: LiveAlert) => {
      setSessions((prev) => {
        const current = prev[alert.sessionId];
        if (!current) return prev;
        const next: StudentSession = {
          ...current,
          status: alert.status,
          violationCount:
            alert.violationCount !== undefined
              ? alert.violationCount
              : current.violationCount,
          totalTimeAway:
            alert.totalTimeAway !== undefined
              ? alert.totalTimeAway
              : current.totalTimeAway,
          updatedTime: new Date().toISOString(),
        };
        return { ...prev, [alert.sessionId]: next };
      });

      if (alert.status === "AWAY") {
        setAwayStarts((prev) => ({
          ...prev,
          [alert.sessionId]: alert.awayStart || Date.now(),
        }));
      } else {
        setAwayStarts((prev) => {
          if (!(alert.sessionId in prev)) return prev;
          const copy = { ...prev };
          delete copy[alert.sessionId];
          return copy;
        });
      }
    };

    const handleStudentDisconnected = ({
      sessionId,
    }: {
      sessionId: string;
    }) => {
      setSessions((prev) => {
        const current = prev[sessionId];
        if (!current || current.status === "SUBMITTED") return prev;
        return {
          ...prev,
          [sessionId]: { ...current, status: "AWAY" },
        };
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("student-joined", handleStudentJoined);
    socket.on("live-alert", handleLiveAlert);
    socket.on("student-disconnected", handleStudentDisconnected);

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("student-joined", handleStudentJoined);
      socket.off("live-alert", handleLiveAlert);
      socket.off("student-disconnected", handleStudentDisconnected);
    };
  }, [examId]);

  const sessionList = useMemo(() => Object.values(sessions), [sessions]);

  const stats = useMemo(() => {
    let active = 0;
    let away = 0;
    let submitted = 0;
    for (const s of sessionList) {
      if (s.status === "ACTIVE") active++;
      else if (s.status === "AWAY") away++;
      else if (s.status === "SUBMITTED") submitted++;
    }
    return { total: sessionList.length, active, away, submitted };
  }, [sessionList]);

  function handleDownload() {
    if (!exam) return;
    downloadExamPdf({
      examTitle: exam.title,
      examId: exam.id,
      generatedAt: new Date(),
      sessions: sessionList,
    });
  }

  async function handleDelete() {
    if (!examId) return;
    setDeleting(true);
    try {
      await deleteExam(examId);
      removeStoredExam(examId);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  if (error && !exam) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 sm:px-6 py-4 text-gray-700 break-words max-w-md">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <header className="max-w-6xl mx-auto mb-4 sm:mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-gray-500 hover:text-gray-700 mb-1"
            >
              ← All exams
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              {exam?.title || "Loading…"}
            </h1>
            <div className="text-xs text-gray-500 mt-1 truncate">
              Exam ID: {examId}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? "bg-green-600" : "bg-gray-400"
              }`}
            />
            <span className="text-gray-700">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatCard label="Registered" value={stats.total} />
        <StatCard label="Active" value={stats.active} accent />
        <StatCard label="Away" value={stats.away} />
        <StatCard label="Submitted" value={stats.submitted} />
      </section>

      <section className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
        <button
          onClick={handleDownload}
          disabled={stats.total === 0}
          className="px-4 py-2 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 text-gray-700 rounded-lg transition text-sm"
        >
          Download PDF
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition text-sm"
        >
          End &amp; Delete
        </button>
      </section>

      <section className="max-w-6xl mx-auto bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-gray-600 text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 sm:px-4 py-3 font-medium">Student</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Status</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Switches</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Total Away</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Current Away</th>
              </tr>
            </thead>
            <tbody>
              {sessionList.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 sm:py-12 text-center text-gray-500"
                  >
                    Waiting for students to join…
                  </td>
                </tr>
              ) : (
                sessionList.map((s) => (
                  <StudentRow
                    key={s.id}
                    session={s}
                    awayStart={awayStarts[s.id]}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirmingDelete && exam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-4 sm:p-6">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              End this exam session?
            </h2>
            <p className="text-sm text-gray-600">
              This permanently deletes <strong>{exam.title}</strong> and all
              recorded student activity from the server. Make sure you've
              downloaded the PDF first if you need it.
            </p>
            {error && (
              <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 break-words">
                {error}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg py-2.5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition"
              >
                {deleting ? "Deleting…" : "Yes, delete it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4">
      <div className="text-[11px] sm:text-xs uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div
        className={`text-2xl sm:text-3xl font-bold mt-1 tabular-nums ${
          accent ? "text-green-700" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
