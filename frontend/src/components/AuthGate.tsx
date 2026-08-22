"use client";

import { FormEvent, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { getCurrentUser, login, logout } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export const AuthGate = () => {
  const [status, setStatus] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    getCurrentUser()
      .then(() => setStatus("signed-in"))
      .catch(() => setStatus("signed-out"));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(username, password);
      setError("");
      setStatus("signed-in");
    } catch {
      setError(t("invalidCredentials"));
    }
  };

  const handleLogout = async () => {
    await logout();
    setStatus("signed-out");
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-[var(--surface)]" aria-busy="true" />;
  }

  if (status === "signed-in") {
    return <KanbanBoard onLogout={handleLogout} remote />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          {t("singleBoard")}
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
          {t("loginPrompt")}
        </p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-semibold text-[var(--navy-dark)]" htmlFor="username">
              {t("username")}
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-3 outline-none focus:border-[var(--primary-blue)]"
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[var(--navy-dark)]" htmlFor="password">
              {t("password")}
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-3 outline-none focus:border-[var(--primary-blue)]"
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <p className="text-sm font-semibold text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 font-semibold text-white transition hover:brightness-110"
            type="submit"
          >
            {t("signIn")}
          </button>
        </form>
      </section>
    </main>
  );
};