"use client";

import { useState } from "react";

import { loginTeacher, registerTeacher } from "@/lib/api";
import { saveAuth, type AuthUser } from "@/lib/auth";

interface Props {
  onSuccess: (user: AuthUser) => void;
}

type Mode = "login" | "register";

export default function AuthForm({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "login"
          ? await loginTeacher(username.trim(), password)
          : await registerTeacher(username.trim(), password);
      saveAuth(result.token, {
        teacherId: result.teacherId,
        username: result.username,
      });
      onSuccess({
        teacherId: result.teacherId,
        username: result.username,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            ExamShield
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {mode === "login"
              ? "Sign in to manage your exams."
              : "Create a teacher account."}
          </p>
        </header>

        <form
          onSubmit={submit}
          className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ms-jones"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
            />
            {mode === "register" && (
              <p className="mt-1 text-xs text-gray-500">
                At least 6 characters.
              </p>
            )}
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
            {submitting
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="text-green-700 hover:text-green-800 font-medium"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="text-green-700 hover:text-green-800 font-medium"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
