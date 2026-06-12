"use client";

import { useEffect, useState } from "react";

import type { StudentSession } from "@/lib/types";
import { formatSeconds } from "@/lib/format";

export interface ProgressInfo {
  questionIndex: number;
  timeLimitSeconds: number;
  startedAt: number; // ms epoch from the server
}

interface Props {
  session: StudentSession;
  awayStart?: number;
  progress?: ProgressInfo;
}

export default function StudentRow({ session, awayStart, progress }: Props) {
  const [liveAway, setLiveAway] = useState(0);
  const [questionRemaining, setQuestionRemaining] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (session.status !== "AWAY" || !awayStart) {
      setLiveAway(0);
      return;
    }
    const tick = () => setLiveAway(Math.floor((Date.now() - awayStart) / 1000));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [session.status, awayStart]);

  useEffect(() => {
    if (!progress || session.status === "SUBMITTED") {
      setQuestionRemaining(null);
      return;
    }
    const compute = () => {
      const elapsed = Math.floor((Date.now() - progress.startedAt) / 1000);
      const left = Math.max(0, progress.timeLimitSeconds - elapsed);
      setQuestionRemaining(left);
    };
    compute();
    const id = window.setInterval(compute, 500);
    return () => window.clearInterval(id);
  }, [progress, session.status]);

  const isAway = session.status === "AWAY";
  const isSubmitted = session.status === "SUBMITTED";

  return (
    <tr
      className={[
        "border-b border-gray-200 transition-colors",
        isAway ? "bg-gray-100" : "bg-white",
        isSubmitted ? "opacity-70" : "",
      ].join(" ")}
    >
      <td className="px-3 sm:px-4 py-3">
        <div className="font-medium text-gray-900">{session.studentName}</div>
        <div className="text-xs text-gray-500">{session.id.slice(0, 8)}</div>
      </td>
      <td className="px-3 sm:px-4 py-3">
        <StatusPill status={session.status} />
      </td>
      <td className="px-3 sm:px-4 py-3 tabular-nums">
        {session.maxScore != null && session.score != null ? (
          <span className="text-gray-900 font-medium">
            {session.score}
            <span className="text-gray-400"> / {session.maxScore}</span>
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 sm:px-4 py-3 tabular-nums">
        {isSubmitted ? (
          <span className="text-gray-400">—</span>
        ) : progress ? (
          <span className="text-gray-900">
            <span className="font-medium">Q{progress.questionIndex + 1}</span>
            {questionRemaining !== null && (
              <span className="text-gray-500"> · {questionRemaining}s</span>
            )}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 sm:px-4 py-3 text-gray-900 tabular-nums">
        {session.violationCount}
      </td>
      <td className="px-3 sm:px-4 py-3 text-gray-900 tabular-nums">
        {formatSeconds(session.totalTimeAway)}
      </td>
      <td className="px-3 sm:px-4 py-3 tabular-nums">
        {isAway ? (
          <span className="font-semibold text-gray-900">
            {formatSeconds(liveAway)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: StudentSession["status"] }) {
  const styles = {
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    AWAY: "bg-gray-200 text-gray-800 border-gray-300",
    SUBMITTED: "bg-white text-gray-500 border-gray-200",
  }[status];

  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded-full ${styles}`}
    >
      {status}
    </span>
  );
}
