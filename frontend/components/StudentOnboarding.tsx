"use client";

import { useState } from "react";

interface Props {
  examTitle: string;
  onJoin: (name: string) => Promise<void> | void;
}

export default function StudentOnboarding({ examTitle, onJoin }: Props) {
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    setJoining(true);
    try {
      await onJoin(name.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join");
      setJoining(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4 sm:p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
            {examTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your full name to begin.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
          />
        </div>

        <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          By entering this exam you agree that your activity may be monitored
          and reported to your teacher.
        </div>

        {error && (
          <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 break-words">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={joining}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
        >
          {joining ? "Joining…" : "Enter Exam"}
        </button>
      </form>
    </div>
  );
}
