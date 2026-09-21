"use client";

import { FormEvent, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LoadingScreen, Spinner } from "@/components/Spinner";
import { WelcomePanel, forgetWelcome } from "@/components/WelcomePanel";
import { getCurrentUser, login, loginAsGuest, logout } from "@/lib/api";
import { facts } from "@/lib/facts";
import { useI18n } from "@/lib/i18n";

const GUEST_SESSION_KEY = "pm-guest-session";
const GUEST_SESSION_MS = 60 * 60 * 1000;

// The API does not expose the session expiry, so the guest start time is kept
// in the browser and reused on a reload when it still belongs to the same guest.
const readGuestStart = (username: string): number | null => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(GUEST_SESSION_KEY) || "null");
    return stored && stored.username === username ? Number(stored.startedAt) : null;
  } catch {
    return null;
  }
};

const rememberGuestStart = (username: string) => {
  const existing = readGuestStart(username);
  if (existing) {
    return existing;
  }
  const startedAt = Date.now();
  try {
    window.localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({ username, startedAt }));
  } catch {
    // Storage blocked: the countdown is simply not shown after a reload.
  }
  return startedAt;
};

const expiryFor = (username: string, startedAt: number | null) =>
  username.startsWith("guest-") && startedAt ? startedAt + GUEST_SESSION_MS : undefined;

type Session =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; username: string; expiresAt?: number };

const PRESSABLE = "transition active:scale-[0.98] active:brightness-95 disabled:cursor-progress disabled:opacity-70";

export const AuthGate = () => {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"demo" | "login" | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    getCurrentUser()
      .then((user) =>
        setSession({
          status: "signed-in",
          username: user.username,
          expiresAt: expiryFor(user.username, readGuestStart(user.username)),
        })
      )
      .catch(() => setSession({ status: "signed-out" }));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending("login");
    try {
      const user = await login(username, password);
      setError("");
      setSession({ status: "signed-in", username: user.username });
    } catch {
      setError(t("entry.invalid"));
    } finally {
      setPending(null);
    }
  };

  const handleGuest = async () => {
    if (pending) {
      return;
    }
    setPending("demo");
    try {
      const guest = await loginAsGuest();
      setError("");
      setSession({
        status: "signed-in",
        username: guest.username,
        expiresAt: expiryFor(guest.username, rememberGuestStart(guest.username)),
      });
    } catch {
      setError(t("entry.demo.error"));
    } finally {
      setPending(null);
    }
  };

  const handleLogout = async () => {
    if (session.status === "signed-in") {
      forgetWelcome(session.username);
    }
    await logout();
    setSession({ status: "signed-out" });
  };

  if (session.status === "loading") {
    return <LoadingScreen label={t("board.loading")} />;
  }

  if (session.status === "signed-in") {
    return (
      <>
        <KanbanBoard onLogout={handleLogout} remote sessionExpiresAt={session.expiresAt} />
        <WelcomePanel username={session.username} />
      </>
    );
  }

  const tries = [t("entry.try1"), t("entry.try2"), t("entry.try3")];

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1240px] items-center gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 lg:py-14">
      <section data-testid="entry-content">
        <p className="eyebrow text-muted">{t("entry.eyebrow")}</p>
        <h1 className="mt-3 font-display text-[40px] font-bold leading-[1.04] text-heading sm:text-[50px]">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-[560px] text-[17px] leading-7 text-body">{t("entry.lead1")}</p>
        <p className="mt-3 max-w-[560px] text-[17px] leading-7 text-body">{t("entry.lead2")}</p>

        <div className="mt-7 max-w-[560px] rounded-[14px] border border-line bg-panel p-4" aria-hidden="true">
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-xl rounded-br-sm bg-primary px-4 py-2.5 text-sm leading-6 text-white">
              {t("entry.sample.prompt")}
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[t("entry.sample.card1"), t("entry.sample.card2")].map((title) => (
              <div
                key={title}
                className="rounded-[11px] border border-line border-t-4 border-t-copilot bg-panel px-3 py-2.5 shadow-card-copilot"
              >
                <p className="text-sm font-semibold text-heading">{title}</p>
                <span className="mt-2 inline-block rounded-full bg-copilot-bg px-2 py-0.5 text-[11px] font-semibold text-copilot-text">
                  {t("card.copilot.chip")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="eyebrow mt-8 text-muted">{t("entry.try.heading")}</p>
        <ul className="mt-3 max-w-[560px] space-y-2">
          {tries.map((item) => (
            <li key={item} className="flex gap-3 text-[15px] leading-6 text-body">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-marker" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>{t("entry.stack")}</span>
          <a
            className="font-semibold text-link underline-offset-4 hover:underline"
            href={facts.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("entry.source")}
          </a>
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>{t("entry.builtby", { name: facts.authorName })}</span>
          <a
            className="font-semibold text-link underline-offset-4 hover:underline"
            href={facts.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("entry.linkedin")}
          </a>
        </p>
      </section>

      <section
        className="w-full rounded-2xl border border-line bg-panel p-6 shadow-access sm:p-8"
        data-testid="entry-access"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold text-heading">{t("entry.card.title")}</h2>
          <LanguageToggle />
        </div>
        <button
          className={`mt-6 flex w-full items-center justify-center gap-2.5 rounded-[11px] bg-primary px-4 py-3.5 text-[15px] font-semibold text-white hover:brightness-110 ${PRESSABLE}`}
          type="button"
          onClick={handleGuest}
          disabled={pending !== null}
          aria-busy={pending === "demo"}
        >
          {pending === "demo" ? <Spinner /> : null}
          {pending === "demo" ? t("entry.demo.loading") : t("entry.demo.button")}
        </button>
        <p className="mt-3 text-[13px] leading-5 text-support">{t("entry.demo.note")}</p>
        <div className="mt-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="eyebrow text-muted">{t("entry.or")}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-semibold text-heading" htmlFor="username">
              {t("entry.username")}
            </label>
            <input
              className="mt-1.5 w-full rounded-[10px] border border-line-strong px-3.5 py-2.5 text-heading outline-none transition focus:border-primary"
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-heading" htmlFor="password">
              {t("entry.password")}
            </label>
            <input
              className="mt-1.5 w-full rounded-[10px] border border-line-strong px-3.5 py-2.5 text-heading outline-none transition focus:border-primary"
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
            className={`flex w-full items-center justify-center gap-2.5 rounded-[11px] border border-line-outline bg-panel px-4 py-3 text-[15px] font-semibold text-heading hover:border-heading active:bg-page ${PRESSABLE}`}
            type="submit"
            disabled={pending !== null}
            aria-busy={pending === "login"}
          >
            {pending === "login" ? <Spinner /> : null}
            {pending === "login" ? t("entry.signin.loading") : t("entry.signin")}
          </button>
        </form>
      </section>
    </main>
  );
};
