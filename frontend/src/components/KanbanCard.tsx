import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { useI18n } from "@/lib/i18n";

type EditableField = "title" | "details";

type KanbanCardProps = {
  card: Card;
  marked?: boolean;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, title: string, details: string) => void;
  onTouch?: (cardId: string) => void;
};

export const KanbanCard = ({ card, marked = false, onDelete, onEdit, onTouch }: KanbanCardProps) => {
  const { t } = useI18n();
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: editingField !== null });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const commit = (field: EditableField, value: string) => {
    setEditingField(null);
    const trimmed = value.trim();
    if (field === "title" && trimmed && trimmed !== card.title) {
      onEdit(card.id, trimmed, card.details);
    }
    if (field === "details" && trimmed !== card.details) {
      onEdit(card.id, card.title, trimmed);
    }
  };

  const cancelOnEscape = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    original: string
  ) => {
    if (event.key === "Escape") {
      event.currentTarget.value = original;
      event.currentTarget.blur();
    }
  };

  // Only the pointer sensor is configured, so the card is not a keyboard-operable
  // button: dropping dnd-kit's role and tabIndex keeps the inner Remove button
  // from being an interactive control nested inside another one.
  const dragProps = editingField ? {} : { ...attributes, ...listeners, role: undefined, tabIndex: undefined };
  const touch = () => {
    if (marked) {
      onTouch?.(card.id);
    }
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-[11px] border border-line bg-panel px-3 py-[11px] motion-safe:transition-shadow motion-safe:duration-200",
        // The purple bar is an inset shadow so the mark never shifts the layout.
        marked
          ? "shadow-[inset_0_4px_0_var(--copilot),var(--shadow-card-copilot)]"
          : "shadow-card",
        isDragging && "opacity-60"
      )}
      {...dragProps}
      onPointerDownCapture={touch}
      onFocusCapture={touch}
      data-testid={`card-${card.id}`}
      data-marked={marked ? "true" : undefined}
    >
      {marked ? (
        <span className="mb-2 inline-block rounded-full bg-copilot-bg px-2 py-0.5 text-[11px] font-semibold text-copilot-text">
          {t("card.copilot.chip")}
        </span>
      ) : null}
      {editingField === "title" ? (
        <input
          autoFocus
          defaultValue={card.title}
          onBlur={(event) => commit("title", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            cancelOnEscape(event, card.title);
          }}
          aria-label={t("card.edit.title")}
          className="w-full rounded-md border border-primary bg-panel px-2 py-1 text-sm font-semibold text-heading outline-none"
        />
      ) : (
        <h4
          onDoubleClick={() => setEditingField("title")}
          title={t("card.edit.hint")}
          className="cursor-text text-sm font-semibold text-heading"
        >
          {card.title}
        </h4>
      )}
      {editingField === "details" ? (
        <textarea
          autoFocus
          defaultValue={card.details}
          rows={3}
          onBlur={(event) => commit("details", event.target.value)}
          onKeyDown={(event) => cancelOnEscape(event, card.details)}
          aria-label={t("card.edit.details")}
          className="mt-1.5 w-full resize-none rounded-md border border-primary bg-panel px-2 py-1 text-[12.5px] leading-[1.45] text-support outline-none"
        />
      ) : (
        <p
          onDoubleClick={() => setEditingField("details")}
          title={t("card.edit.hint")}
          className="mt-1.5 cursor-text text-[12.5px] leading-[1.45] text-support"
        >
          {card.details}
        </p>
      )}
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="-mb-1 -mr-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-link transition hover:bg-page"
          aria-label={`${t("card.remove")} ${card.title}`}
        >
          {t("card.remove")}
        </button>
      </div>
    </article>
  );
};
