"use client";

import { FormEvent, useState } from "react";
import { chat, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { useI18n } from "@/lib/i18n";

export const AIChatSidebar = ({
  onBoardUpdate,
}: {
  onBoardUpdate: (board: BoardData) => void;
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) {
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, content: trimmedQuestion }];
    setMessages(nextMessages);
    setQuestion("");
    setError("");
    setIsSending(true);

    try {
      const result = await chat(trimmedQuestion, messages);
      setMessages([...nextMessages, { role: "assistant", content: result.response }]);
      if (result.board) {
        onBoardUpdate(result.board);
      }
    } catch {
      setError(t("aiError"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside className="rounded-[28px] border border-[var(--stroke)] bg-white/85 p-6 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            {t("assistant")}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
            {t("copilot")}
          </h2>
        </div>
        <span className="h-3 w-3 rounded-full bg-[var(--accent-yellow)]" aria-label={t("available")} />
      </div>
      <div className="mt-5 min-h-[120px] space-y-3" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            {t("askPrompt")}
          </p>
        ) : (
          messages.map((message, index) => (
            <p
              className={`rounded-xl px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-8 bg-[var(--navy-dark)] text-white"
                  : "mr-8 bg-[var(--surface)] text-[var(--navy-dark)]"
              }`}
              key={`${message.role}-${index}`}
            >
              {message.content}
            </p>
          ))
        )}
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
      <form className="mt-5 flex gap-3" onSubmit={handleSubmit}>
        <input
          className="min-w-0 flex-1 rounded-xl border border-[var(--stroke)] px-4 py-3 text-sm outline-none focus:border-[var(--primary-blue)]"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("askAssistant")}
          aria-label="AI question"
        />
        <button
          className="rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={isSending || !question.trim()}
          type="submit"
        >
          {isSending ? t("sending") : t("send")}
        </button>
      </form>
    </aside>
  );
};