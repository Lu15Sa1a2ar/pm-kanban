"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SiteFooter } from "@/components/SiteFooter";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";
import { getBoard, saveBoard } from "@/lib/api";
import { cardCountLabel, useI18n } from "@/lib/i18n";

export const COPILOT_MARK_MS = 8000;

const minutesLeft = (expiresAt: number, now: number) => Math.max(0, Math.ceil((expiresAt - now) / 60_000));

export const KanbanBoard = ({
  onLogout = () => undefined,
  remote = false,
  sessionExpiresAt,
}: {
  onLogout?: () => void | Promise<void>;
  remote?: boolean;
  sessionExpiresAt?: number;
}) => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(remote);
  const [saveError, setSaveError] = useState("");
  const [markedCardIds, setMarkedCardIds] = useState<ReadonlySet<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const { t } = useI18n();
  const hasLoadedRemoteBoard = useRef(!remote);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  useEffect(() => {
    if (!remote) {
      return;
    }

    getBoard()
      .then((remoteBoard) => {
        setBoard(remoteBoard);
        hasLoadedRemoteBoard.current = true;
        setIsLoading(false);
      })
      .catch(() => {
        setSaveError(t("board.load.error"));
        setIsLoading(false);
      });
  }, [remote, t]);

  useEffect(() => {
    if (!sessionExpiresAt) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (markTimeoutRef.current) {
        clearTimeout(markTimeoutRef.current);
      }
    };
  }, []);

  const persistBoard = useCallback(
    (nextBoard: BoardData) => {
      if (!remote || !hasLoadedRemoteBoard.current) {
        return;
      }
      saveBoard(nextBoard)
        .then(() => setSaveError(""))
        .catch(() => setSaveError(t("board.save.error")));
    },
    [remote, t]
  );

  const persistBoardDebounced = useCallback(
    (nextBoard: BoardData) => {
      if (!remote || !hasLoadedRemoteBoard.current) {
        return;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => persistBoard(nextBoard), 500);
    },
    [remote, persistBoard]
  );

  // The backend already saved the copilot's board; here it only replaces the
  // local state and marks the changed cards for a few seconds.
  const handleCopilotUpdate = useCallback((nextBoard: BoardData, changedCardIds: string[]) => {
    setBoard(nextBoard);
    setMarkedCardIds(new Set(changedCardIds));
    if (markTimeoutRef.current) {
      clearTimeout(markTimeoutRef.current);
    }
    markTimeoutRef.current = setTimeout(() => setMarkedCardIds(new Set()), COPILOT_MARK_MS);
  }, []);

  const handleTouchCard = useCallback((cardId: string) => {
    setMarkedCardIds((current) => {
      if (!current.has(cardId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const nextBoard = {
      ...board,
      columns: moveCard(board.columns, active.id as string, over.id as string),
    };
    setBoard(nextBoard);
    persistBoard(nextBoard);
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    const nextBoard = {
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    };
    setBoard(nextBoard);
    persistBoardDebounced(nextBoard);
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    const nextBoard = {
      ...board,
      cards: {
        ...board.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    };
    setBoard(nextBoard);
    persistBoard(nextBoard);
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    const nextBoard = {
      ...board,
      cards: {
        ...board.cards,
        [cardId]: { ...board.cards[cardId], title, details },
      },
    };
    setBoard(nextBoard);
    persistBoard(nextBoard);
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    const nextBoard = {
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    };
    setBoard(nextBoard);
    persistBoard(nextBoard);
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (isLoading) {
    return <div className="min-h-screen bg-page" aria-busy="true" />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-5 py-5 sm:px-6">
      <header className="rounded-2xl border border-line bg-panel">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-muted">{t("entry.eyebrow")}</p>
            <h1 className="mt-1.5 font-display text-[28px] font-bold leading-[1.1] text-heading">{t("title")}</h1>
            <p className="mt-1.5 text-sm leading-6 text-body lg:truncate">{t("board.description")}</p>
          </div>
          <div className="shrink-0 rounded-[10px] bg-focus-bg px-4 py-3">
            <p className="eyebrow text-link">{t("board.focus")}</p>
            <p className="mt-1 text-[15px] font-semibold text-link">{t("board.focus.value")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
          <ul className="flex flex-wrap gap-2">
            {board.columns.map((column) => {
              const count = column.cardIds.length;
              return (
                <li
                  key={column.id}
                  data-testid={`pill-${column.id}`}
                  data-empty={count === 0 ? "true" : undefined}
                  className={clsx(
                    "flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold",
                    count === 0 ? "text-muted" : "text-heading"
                  )}
                >
                  <span
                    className={clsx("h-2 w-2 rounded-full", count === 0 ? "bg-pill-muted" : "bg-marker")}
                    aria-hidden="true"
                  />
                  <span>{column.title}</span>
                  <span className="font-normal text-muted">{cardCountLabel(t, count)}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            {sessionExpiresAt ? (
              <span className="text-xs font-semibold text-support" data-testid="session-countdown">
                {t("board.session", { minutes: minutesLeft(sessionExpiresAt, now) })}
              </span>
            ) : null}
            <LanguageToggle />
            <button
              className="rounded-lg border border-line-outline px-3.5 py-2 text-sm font-semibold text-heading transition hover:border-heading"
              onClick={onLogout}
              type="button"
            >
              {t("board.logout")}
            </button>
          </div>
        </div>
        {saveError ? (
          <p className="border-t border-line px-5 py-3 text-sm font-semibold text-red-700 sm:px-6" role="alert">
            {saveError}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section
            className="flex min-w-0 flex-1 snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:items-start md:overflow-visible md:pb-0"
            data-testid="board-columns"
          >
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                markedCardIds={markedCardIds}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
                onTouchCard={handleTouchCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {remote ? <AIChatSidebar board={board} onBoardUpdate={handleCopilotUpdate} /> : null}
      </div>

      <SiteFooter />
    </main>
  );
};
