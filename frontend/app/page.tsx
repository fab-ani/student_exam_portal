"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AuthForm from "@/components/AuthForm";
import ExamCard from "@/components/ExamCard";
import QuestionBuilder from "@/components/QuestionBuilder";
import { createExam, fetchMe, listMyExams } from "@/lib/api";
import { clearAuth, getUser, type AuthUser } from "@/lib/auth";
import type { Exam, QuestionDraft } from "@/lib/types";

function initialQuestions(): QuestionDraft[] {
  return [
    {
      text: "",
      timeLimitSeconds: 30,
      options: [
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ],
    },
  ];
}

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [exams, setExams] = useState<Exam[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialQuestions()
  );
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    portal: string;
    teacher: string;
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    setListError(null);
    setLoadingList(true);
    try {
      const list = await listMyExams();
      setExams(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load exams";
      setListError(msg);
      if (/sign in again/i.test(msg)) {
        setUser(null);
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Hydrate auth on mount, refresh `me` against the server to catch expired tokens.
  useEffect(() => {
    const cached = getUser();
    if (!cached) {
      setHydrated(true);
      return;
    }
    setUser(cached);
    fetchMe()
      .then((me) => {
        setUser(me);
        return refresh();
      })
      .catch(() => {
        clearAuth();
        setUser(null);
      })
      .finally(() => setHydrated(true));
  }, [refresh]);

  useEffect(() => {
    if (hydrated && user && exams.length === 0 && !loadingList && !listError) {
      setShowCreate(true);
    }
  }, [hydrated, user, exams.length, loadingList, listError]);

  function logout() {
    clearAuth();
    setUser(null);
    setExams([]);
  }

  function resetCreateForm() {
    setTitle("");
    setQuestions(initialQuestions());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setSubmitting(true);
    try {
      const exam = await createExam({ title, questions });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setCreated({
        id: exam.id,
        portal: `${origin}/portal/${exam.id}`,
        teacher: `${origin}/teacher/${exam.id}`,
      });
      resetCreateForm();
      await refresh();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  if (!user) {
    return (
      <AuthForm
        onSuccess={(u) => {
          setUser(u);
          refresh();
        }}
      />
    );
  }

  return (
    <main className="min-h-screen flex items-start justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl py-6">
        <header className="mb-6 sm:mb-8 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              ExamShield
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Signed in as{" "}
              <span className="font-medium text-gray-700">{user.username}</span>
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </header>

        {exams.length > 0 && (
          <section className="mb-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm uppercase tracking-wider text-gray-500 font-semibold">
                Your Exams
              </h2>
              <span className="text-xs text-gray-400">
                {exams.length} on server
              </span>
            </div>
            <div className="space-y-3">
              {exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} onChanged={refresh} />
              ))}
            </div>
          </section>
        )}

        {listError && (
          <div className="mb-4 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 break-words">
            {listError}
          </div>
        )}

        {!created ? (
          <section>
            {exams.length > 0 && !showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg transition"
              >
                + New Exam
              </button>
            )}

            {(exams.length === 0 || showCreate) && (
              <form
                onSubmit={onSubmit}
                className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 space-y-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm uppercase tracking-wider text-gray-500 font-semibold">
                    New Exam
                  </h2>
                  {exams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false);
                        setCreateError(null);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>

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
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Questions
                  </div>
                  <QuestionBuilder
                    questions={questions}
                    onChange={setQuestions}
                  />
                </div>

                {createError && (
                  <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 break-words">
                    {createError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
                >
                  {submitting ? "Creating…" : "Create Exam"}
                </button>
              </form>
            )}
          </section>
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
                onClick={() => setCreated(null)}
                className="px-4 py-3 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition"
              >
                Done
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
