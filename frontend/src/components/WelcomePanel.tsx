"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { facts } from "@/lib/facts";
import { useI18n } from "@/lib/i18n";

// sessionStorage, keyed by user: a fresh tab or a different user (a new guest, a
// new sign-in) shows the panel; a reload of the same user in the same tab does not.
export const welcomeSeenKey = (username: string) => `pm-welcome-seen:${username}`;

const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

const hasSeenWelcome = (username: string) => {
  try {
    return window.sessionStorage.getItem(welcomeSeenKey(username)) === "1";
  } catch {
    return false;
  }
};

const rememberWelcome = (username: string) => {
  try {
    window.sessionStorage.setItem(welcomeSeenKey(username), "1");
  } catch {
    // Storage blocked: the panel simply shows again next time.
  }
};

export const forgetWelcome = (username: string) => {
  try {
    window.sessionStorage.removeItem(welcomeSeenKey(username));
  } catch {
    // Nothing to forget.
  }
};

export const WelcomePanel = ({ username }: { username: string }) => {
  const [isOpen, setIsOpen] = useState(() => !hasSeenWelcome(username));
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    openerRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [isOpen]);

  const close = () => {
    rememberWelcome(username);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) {
    return null;
  }

  const items = [
    { title: t("welcome.item1.title"), body: t("welcome.item1.body") },
    { title: t("welcome.item2.title"), body: t("welcome.item2.body") },
    { title: t("welcome.item3.title"), body: t("welcome.item3.body") },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4"
      onClick={close}
      data-testid="welcome-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-heading"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-[560px] rounded-2xl bg-panel p-7 shadow-welcome motion-safe:animate-[welcome-in_180ms_ease-out] sm:p-9"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("welcome.close")}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-page hover:text-heading"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
        <p className="eyebrow text-copilot">{t("welcome.eyebrow")}</p>
        <h2 id="welcome-heading" className="mt-2 font-display text-[30px] font-bold leading-[1.15] text-heading">
          {t("welcome.heading")}
        </h2>
        <p className="mt-3 text-[15px] leading-6 text-body">{t("welcome.lead")}</p>
        <ol className="mt-6 space-y-4">
          {items.map((item, index) => (
            <li key={item.title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-focus-bg text-xs font-bold text-link">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-heading">{item.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-body">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={close}
            className="rounded-[10px] bg-primary px-5 py-3 text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98] active:brightness-95"
          >
            {t("welcome.start")}
          </button>
          <a
            href={facts.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-link underline-offset-4 hover:underline"
          >
            {t("entry.source")}
          </a>
        </div>
      </div>
    </div>
  );
};
