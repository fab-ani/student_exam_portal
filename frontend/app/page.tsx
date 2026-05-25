"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createExam } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    portal: string;
    teacher: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const exam = await createExam({ title, googleFormUrl: url });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setCreated({
        id: exam.id,
        portal: `${origin}/portal/${exam.id}`,
        teacher: `${origin}/teacher/${exam.id}`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl">
        <header className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            ExamShield
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-500">
            Wrap a Google Form. Track tab switches in real time.
          </p>
        </header>

        {!created ? (
          <form
            onSubmit={onSubmit}
            className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exam Name
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Midterm — Algorithms"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Form URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/forms/..."
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be a docs.google.com or forms.gle link.
              </p>
            </div>

            {error && (
              <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 break-words">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
            >
              {submitting ? "Generating…" : "Generate Monitored Link"}
            </button>
          </form>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="text-green-700 font-medium">Exam created.</div>
            <LinkBlock label="Share with students" value={created.portal} />
            <LinkBlock label="Open your live monitor" value={created.teacher} />
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => router.push(`/teacher/${created.id}`)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Open Live Dashboard
              </button>
              <button
                onClick={() => {
                  setCreated(null);
                  setTitle("");
                  setUrl("");
                }}
                className="px-4 py-3 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition"
              >
                Create another
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function LinkBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={value}
          className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm"
        />
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm transition"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
