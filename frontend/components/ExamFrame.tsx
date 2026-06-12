"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { submitAnswers } from "@/lib/api";
import type { Question } from "@/lib/types";

interface Props {
  socket: Socket;
  sessionId: string;
  studentName: string;
  examTitle: string;
  questions: Question[];
  onFinished: (result: { score: number; maxScore: number }) => void;
}

export default function ExamFrame({
  socket,
  sessionId,
  studentName,
  examTitle,
  questions,
  onFinished,
}: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(
    questions[0]?.timeLimitSeconds ?? 30
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSubmitReason, setAutoSubmitReason] = useState<
    "tab-switch" | "timeout" | null
  >(null);

  const finishedRef = useRef(false);
  const indexRef = useRef(0);
  const answersRef = useRef<Record<string, string>>({});

  const currentQ = questions[index];
  const isLast = index >= questions.length - 1;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Reset countdown when arriving at a new question.
  useEffect(() => {
    if (currentQ) setRemaining(currentQ.timeLimitSeconds);
  }, [currentQ?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the teacher dashboard which question this student is currently on.
  useEffect(() => {
    const q = questions[index];
    if (!q || finishedRef.current) return;
    socket.emit("question-progress", {
      questionIndex: index,
      timeLimitSeconds: q.timeLimitSeconds,
    });
  }, [index, questions, socket]);

  const handleSubmit = useCallback(
    async (opts?: { tabSwitchTriggered?: boolean }) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const payload = questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answersRef.current[q.id] || null,
        }));
        const result = await submitAnswers(sessionId, payload, {
          tabSwitchTriggered: opts?.tabSwitchTriggered,
        });
        onFinished({ score: result.score, maxScore: result.maxScore });
      } catch (err) {
        finishedRef.current = false;
        setError(err instanceof Error ? err.message : "Failed to submit");
      } finally {
        setSubmitting(false);
      }
    },
    [questions, sessionId, onFinished]
  );

  const advance = useCallback(
    (reason: "manual" | "timeout") => {
      if (finishedRef.current) return;
      const i = indexRef.current;
      if (i >= questions.length - 1) {
        if (reason === "timeout") setAutoSubmitReason("timeout");
        handleSubmit();
      } else {
        setIndex(i + 1);
      }
    },
    [handleSubmit, questions.length]
  );

  // Tick down once per second; auto-advance at zero.
  useEffect(() => {
    if (finishedRef.current) return;
    if (remaining <= 0) {
      advance("timeout");
      return;
    }
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining, advance]);

  // Tab/window switch → record the violation AND auto-submit immediately.
  useEffect(() => {
    function onVisibility() {
      if (finishedRef.current) return;
      if (document.hidden) {
        socket.emit("signal-violation-away", { awayStart: Date.now() });
        setAutoSubmitReason("tab-switch");
        handleSubmit({ tabSwitchTriggered: true });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [socket, handleSubmit]);

  function setAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  if (!currentQ) return null;

  const timeLow = remaining <= 5;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-gray-200">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-gray-800 truncate">{studentName}</div>
          <div className="text-xs text-gray-500 truncate">{examTitle}</div>
        </div>

        <div className="shrink-0 text-center">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Time
          </div>
          <div
            className={`text-lg font-bold tabular-nums leading-none mt-0.5 ${
              timeLow ? "text-gray-900" : "text-gray-900"
            }`}
          >
            {Math.max(0, remaining)}s
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
            Question {index + 1} of {questions.length}
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="text-base sm:text-lg font-medium text-gray-900 whitespace-pre-wrap">
              {currentQ.text}
            </div>
            <div className="space-y-2">
              {currentQ.options.map((opt) => {
                const selected = answers[currentQ.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAnswer(currentQ.id, opt.id)}
                    disabled={submitting || finishedRef.current}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition disabled:opacity-60 ${
                      selected
                        ? "border-green-600 bg-green-50"
                        : "border-gray-300 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selected
                          ? "bg-green-600 border-green-600"
                          : "border-gray-300"
                      }`}
                    >
                      {selected && (
                        <span className="block w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="text-sm sm:text-base text-gray-800">
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => advance("manual")}
              disabled={submitting || finishedRef.current}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
            >
              {submitting
                ? "Submitting…"
                : isLast
                  ? "Finish & Submit"
                  : "Next Question"}
            </button>

            {error && (
              <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 break-words">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {autoSubmitReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-4 sm:p-6">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-3 text-center">
            <h2 className="text-lg font-bold text-gray-900">
              {autoSubmitReason === "tab-switch"
                ? "Tab switch detected"
                : "Time's up"}
            </h2>
            <p className="text-sm text-gray-600">
              {autoSubmitReason === "tab-switch"
                ? "Your exam has been auto-submitted because you left the page."
                : "Your exam has been auto-submitted."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
