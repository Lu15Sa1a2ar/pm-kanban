import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { useI18n } from "@/lib/i18n";

type EditableField = "title" | "details";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, title: string, details: string) => void;
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
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

  const dragProps = editingField ? {} : { ...attributes, ...listeners };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...dragProps}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
              aria-label={t("editTitle")}
              className="w-full rounded-lg border border-[var(--primary-blue)] bg-white px-2 py-1 font-display text-base font-semibold text-[var(--navy-dark)] outline-none"
            />
          ) : (
            <h4
              onDoubleClick={() => setEditingField("title")}
              title={t("doubleClickToEdit")}
              className="cursor-text font-display text-base font-semibold text-[var(--navy-dark)]"
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
              aria-label={t("editDetails")}
              className="mt-2 w-full resize-none rounded-lg border border-[var(--primary-blue)] bg-white px-2 py-1 text-sm leading-6 text-[var(--gray-text)] outline-none"
            />
          ) : (
            <p
              onDoubleClick={() => setEditingField("details")}
              title={t("doubleClickToEdit")}
              className="mt-2 cursor-text text-sm leading-6 text-[var(--gray-text)]"
            >
              {card.details}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
          aria-label={`${t("remove")} ${card.title}`}
        >
          {t("remove")}
        </button>
      </div>
    </article>
  );
};
