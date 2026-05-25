"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteExam } from "@/lib/api";
import { downloadExamPdf } from "@/lib/pdf";
import { removeStoredExam, type StoredExam } from "@/lib/storage";

interface Props {
  exam: StoredExam;
  onChanged: () => void;
}

export default function StoredExamCard({ exam, onChanged }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const list = Object.values(exam.sessions || {});
    let active = 0;
    let away = 0;
    let submitted = 0;
    for (const s of list) {
      if (s.status === "ACTIVE") active++;
      else if (s.status === "AWAY") away++;
      else if (s.status === "SUBMITTED") submitted++;
    }
    return { total: list.length, active, away, submitted };
  }, [exam.sessions]);

  function handleDownload() {
    downloadExamPdf({
      examTitle: exam.title,
      examId: exam.id,
      generatedAt: new Date(),
      sessions: Object.values(exam.sessions || {}),
    });
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteExam(exam.id);
      removeStoredExam(exam.id);
      setConfirming(false);
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{exam.title}</h3>
          <div className="text-xs text-gray-500 mt-0.5">
            Updated {new Date(exam.lastUpdated).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} accent />
        <Stat label="Away" value={stats.away} />
        <Stat label="Done" value={stats.submitted} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          onClick={() => router.push(`/teacher/${exam.id}`)}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
        >
          Open Dashboard
        </button>
        <button
          onClick={handleDownload}
          disabled={stats.total === 0}
          className="px-3 py-2 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 text-gray-700 rounded-lg transition text-sm"
        >
          Download PDF
        </button>
        <button
          onClick={() => setConfirming(true)}
          className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition text-sm"
        >
          End &amp; Delete
        </button>
      </div>

      {confirming && (
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
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
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
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg py-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums ${
          accent ? "text-green-700" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
