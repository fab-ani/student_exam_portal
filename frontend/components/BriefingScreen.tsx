"use client";

import { useState } from "react";

interface Props {
  examTitle: string;
  studentName: string;
  questionCount: number;
  onStart: () => void;
}

export default function BriefingScreen({
  examTitle,
  studentName,
  questionCount,
  onStart,
}: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
            {examTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {studentName} · {questionCount} question
            {questionCount === 1 ? "" : "s"}
          </p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Before you start
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <Rule>
              Each question has its own time limit. When it runs out, the next
              question loads automatically.
            </Rule>
            <Rule>
              You cannot go back to a previous question once you've moved on.
            </Rule>
            <Rule>
              Switching tabs, minimizing the window, or leaving this page will
              <strong> auto-submit your exam instantly</strong> — even if you
              haven't finished.
            </Rule>
            <Rule>
              Your teacher is monitoring this session live. Tab switches and
              away time are recorded.
            </Rule>
            <Rule>
              Stay on a stable internet connection. If you reload the page,
              your session resumes from the current question.
            </Rule>
          </ul>
        </div>

        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-green-600 cursor-pointer"
          />
          <span className="text-sm text-gray-700">
            I understand the rules and I'm ready to start.
          </span>
        </label>

        <button
          onClick={onStart}
          disabled={!agreed}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
        >
          Start Exam
        </button>
      </div>
    </main>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
