"use client";

import { FormEvent, useState } from "react";
import { AssistantMessage } from "@/components/AssistantMessage";
import { ApiError, chat, type ChatMessage } from "@/lib/api";
import { facts } from "@/lib/facts";
import { diffBoards, type BoardData } from "@/lib/kanban";
import { useI18n } from "@/lib/i18n";

// `updated` stays local: the history sent to the backend carries role and content only.
type ThreadMessage = ChatMessage & { updated?: number };

const toHistory = (messages: ThreadMessage[]): ChatMessage[] =>
  messages.map(({ role, content }) => ({ role, content }));

export const AIChatSidebar = ({
  board,
  onBoardUpdate,
}: {
  board: BoardData;
  onBoardUpdate: (board: BoardData, changedCardIds: string[]) => void;
}) => {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();
  const used = messages.filter((message) => message.role === "user").length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) {
      return;
    }

    const nextMessages: ThreadMessage[] = [...messages, { role: "user", content: trimmedQuestion }];
    setMessages(nextMessages);
    setQuestion("");
    setError("");
    setIsSending(true);

    try {
      const result = await chat(trimmedQuestion, toHistory(messages));
      const reply: ThreadMessage = { role: "assistant", content: result.response };
      if (result.board) {
        const changed = diffBoards(board, result.board);
        reply.updated = changed.length;
        onBoardUpdate(result.board, changed);
      }
      setMessages([...nextMessages, reply]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setError(t(error.message === "ai_daily_limit" ? "copilot.limit.daily" : "copilot.limit.session"));
      } else {
        setError(t("copilot.error"));
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      className="flex w-full flex-col rounded-[14px] border border-line bg-panel px-[13px] py-3.5 xl:w-[340px] xl:shrink-0"
      data-testid="copilot-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-copilot" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-heading">{t("copilot.title")}</h2>
        </div>
        <span className="eyebrow text-muted" data-testid="copilot-counter">
          {t("copilot.counter", { used, limit: facts.copilotMessagesPerSession })}
        </span>
      </div>
      <div className="mt-4 min-h-[160px] flex-1 space-y-2.5" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-support">{t("copilot.label")}</p>
        ) : (
          messages.map((message, index) => (
            <div
              className={
                message.role === "user"
                  ? "ml-8 whitespace-pre-wrap rounded-xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm leading-6 text-white"
                  : "mr-6 rounded-xl rounded-bl-sm bg-page px-3.5 py-2.5 text-sm leading-6 text-body-strong"
              }
              data-testid="chat-message"
              key={`${message.role}-${index}`}
            >
              {message.role === "assistant" ? <AssistantMessage content={message.content} /> : message.content}
              {message.updated ? (
                <p
                  className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-xs font-semibold text-copilot-text"
                  data-testid="copilot-summary"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-copilot" aria-hidden="true" />
                  {message.updated === 1
                    ? t("copilot.updated.one")
                    : t("copilot.updated", { count: message.updated })}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
      <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
        <input
          className="min-w-0 flex-1 rounded-[10px] border border-line-strong px-3.5 py-2.5 text-sm text-heading outline-none transition placeholder:text-muted-soft focus:border-primary"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("copilot.placeholder")}
          aria-label={t("copilot.label")}
        />
        <button
          className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] active:brightness-95 disabled:opacity-50"
          disabled={isSending || !question.trim()}
          type="submit"
        >
          {isSending ? t("copilot.sending") : t("copilot.send")}
        </button>
      </form>
    </aside>
  );
};
