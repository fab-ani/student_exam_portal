"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Status = "ACTIVE" | "AWAY" | "SUBMITTED";

export default function ExamFrame({
  socket,
  sessionId,
  studentName,
  examTitle,
  questions,
  onFinished,
}: Props) {
  const [status, setStatus] = useState<Status>("ACTIVE");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const awayStartRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    function handleAway() {
      if (finishedRef.current || awayStartRef.current !== null) return;
      awayStartRef.current = performance.now();
      socket.emit("signal-violation-away", { awayStart: Date.now() });
    }

    function handleReturn() {
      if (finishedRef.current || awayStartRef.current === null) return;
      const duration = Math.max(
        0,
        Math.round((performance.now() - awayStartRef.current) / 1000)
      );
      awayStartRef.current = null;
      socket.emit("signal-violation-return", { duration });
    }

    function onVisibility() {
      if (document.hidden) handleAway();
      else handleReturn();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [socket]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => !!v).length,
    [answers]
  );
  const allAnswered = answeredCount === questions.length;

  function setAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        selectedOptionId: answers[q.id] || null,
      }));
      const result = await submitAnswers(sessionId, payload);
      setStatus("SUBMITTED");
      onFinished({ score: result.score, maxScore: result.maxScore });
    } catch (err: unknown) {
      finishedRef.current = false;
      setSubmitError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-gray-200">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-gray-800 truncate">{studentName}</div>
          <div className="text-xs text-gray-500 truncate">{examTitle}</div>
        </div>

        <div className="hidden sm:block text-xs text-gray-500 shrink-0">
          {answeredCount} / {questions.length} answered
        </div>

        <button
          onClick={() => setConfirmingFinish(true)}
          disabled={status === "SUBMITTED"}
          className="shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-3 sm:px-4 py-2 rounded-lg transition"
        >
          <span className="sm:hidden">Submit</span>
          <span className="hidden sm:inline">Submit Exam</span>
        </button>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3"
            >
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                Question {idx + 1} of {questions.length}
              </div>
              <div className="text-base sm:text-lg font-medium text-gray-900 whitespace-pre-wrap">
                {q.text}
              </div>
              <div className="space-y-2 pt-1">
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAnswer(q.id, opt.id)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition ${
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
            </div>
          ))}
        </div>
      </div>

      {confirmingFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-4 sm:p-6">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Submit exam?</h2>
            <p className="text-sm text-gray-600">
              You answered <strong>{answeredCount}</strong> of{" "}
              <strong>{questions.length}</strong> questions.{" "}
              {!allAnswered &&
                "Unanswered questions are counted as incorrect. "}
              You cannot change your answers after submitting.
            </p>
            {submitError && (
              <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 break-words">
                {submitError}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setConfirmingFinish(false)}
                disabled={submitting}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg py-2.5 transition"
              >
                Keep answering
              </button>
              <button
                onClick={finish}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
