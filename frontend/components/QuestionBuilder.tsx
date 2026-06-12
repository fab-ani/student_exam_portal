"use client";

import type { QuestionDraft } from "@/lib/types";

interface Props {
  questions: QuestionDraft[];
  onChange: (next: QuestionDraft[]) => void;
}

function emptyQuestion(): QuestionDraft {
  return {
    text: "",
    timeLimitSeconds: 30,
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  };
}

function clampSeconds(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.max(5, Math.min(3600, Math.round(n)));
}

export default function QuestionBuilder({ questions, onChange }: Props) {
  function update(idx: number, patch: Partial<QuestionDraft>) {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateOption(
    qIdx: number,
    oIdx: number,
    patch: Partial<{ text: string; isCorrect: boolean }>
  ) {
    onChange(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)),
        };
      })
    );
  }

  function setCorrect(qIdx: number, oIdx: number) {
    onChange(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIdx })),
        };
      })
    );
  }

  function addOption(qIdx: number) {
    onChange(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: [...q.options, { text: "", isCorrect: false }],
        };
      })
    );
  }

  function removeOption(qIdx: number, oIdx: number) {
    onChange(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        const next = q.options.filter((_, j) => j !== oIdx);
        // ensure exactly one correct option remains
        if (!next.some((o) => o.isCorrect) && next.length > 0) {
          next[0] = { ...next[0], isCorrect: true };
        }
        return { ...q, options: next };
      })
    );
  }

  function addQuestion() {
    onChange([...questions, emptyQuestion()]);
  }

  function removeQuestion(idx: number) {
    onChange(questions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qIdx) => (
        <div
          key={qIdx}
          className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Question {qIdx + 1}
            </div>
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => removeQuestion(qIdx)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Remove
              </button>
            )}
          </div>

          <input
            type="text"
            required
            value={q.text}
            onChange={(e) => update(qIdx, { text: e.target.value })}
            placeholder="Type your question here"
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
          />

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Time limit (seconds)</label>
            <input
              type="number"
              min={5}
              max={3600}
              step={5}
              value={q.timeLimitSeconds}
              onChange={(e) =>
                update(qIdx, {
                  timeLimitSeconds: clampSeconds(parseInt(e.target.value, 10)),
                })
              }
              className="w-20 bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
            />
          </div>

          <div className="space-y-2">
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(qIdx, oIdx)}
                  aria-label={
                    opt.isCorrect ? "Correct answer" : "Mark as correct"
                  }
                  className={`shrink-0 w-5 h-5 rounded-full border-2 transition ${
                    opt.isCorrect
                      ? "bg-green-600 border-green-600"
                      : "bg-white border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {opt.isCorrect && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-white mx-auto" />
                  )}
                </button>
                <input
                  type="text"
                  required
                  value={opt.text}
                  onChange={(e) =>
                    updateOption(qIdx, oIdx, { text: e.target.value })
                  }
                  placeholder={`Option ${oIdx + 1}`}
                  className="flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
                />
                {q.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(qIdx, oIdx)}
                    className="shrink-0 text-gray-400 hover:text-gray-600 px-1"
                    aria-label="Remove option"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(qIdx)}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              + Add option
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addQuestion}
        className="w-full bg-white hover:bg-gray-100 border border-dashed border-gray-300 text-gray-700 font-medium py-3 rounded-lg transition"
      >
        + Add Question
      </button>
    </div>
  );
}
