"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

interface Props {
  socket: Socket;
  studentName: string;
  googleFormUrl: string;
  onFinished: () => void;
}

type Status = "ACTIVE" | "AWAY" | "SUBMITTED";

export default function ExamFrame({
  socket,
  studentName,
  googleFormUrl,
  onFinished,
}: Props) {
  const [status, setStatus] = useState<Status>("ACTIVE");
  const [confirmingFinish, setConfirmingFinish] = useState(false);

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
    function onBlur() {
      handleAway();
    }
    function onFocus() {
      handleReturn();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [socket]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setStatus("SUBMITTED");
    socket.emit("submit-session", {}, () => {
      onFinished();
    });
    window.setTimeout(() => onFinished(), 1000);
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <header className="flex items-center justify-between gap-3 px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-gray-200">
        <span className="text-sm text-gray-800 truncate min-w-0 flex-1">
          {studentName}
        </span>

        <button
          onClick={() => setConfirmingFinish(true)}
          disabled={status === "SUBMITTED"}
          className="shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-3 sm:px-4 py-2 rounded-lg transition"
        >
          <span className="sm:hidden">Lock</span>
          <span className="hidden sm:inline">Finish &amp; Lock Session</span>
        </button>
      </header>

      <div className="flex-1 relative bg-white">
        <iframe
          src={googleFormUrl}
          title="Exam"
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {confirmingFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-4 sm:p-6">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Lock session?</h2>
            <p className="text-sm text-gray-600">
              Make sure you have hit{" "}
              <span className="text-gray-900 font-medium">Submit</span> inside
              the Google Form first. Locking your session ends monitoring and
              cannot be undone.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setConfirmingFinish(false)}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg py-2.5 transition"
              >
                Cancel
              </button>
              <button
                onClick={finish}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg py-2.5 transition"
              >
                Yes, lock it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
