import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";
import { cardCountLabel, useI18n } from "@/lib/i18n";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  markedCardIds?: ReadonlySet<string>;
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onEditCard: (cardId: string, title: string, details: string) => void;
  onTouchCard?: (cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  markedCardIds,
  onRename,
  onAddCard,
  onDeleteCard,
  onEditCard,
  onTouchCard,
}: KanbanColumnProps) => {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex w-[260px] shrink-0 snap-start flex-col rounded-[14px] border border-line bg-panel px-[13px] py-3.5 transition md:w-auto md:shrink",
        isOver && "ring-2 ring-marker"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-8 rounded-full bg-marker" aria-hidden="true" />
        <span className="eyebrow text-muted">{cardCountLabel(t, cards.length)}</span>
      </div>
      <input
        value={column.title}
        onChange={(event) => onRename(column.id, event.target.value)}
        className="mt-2 w-full rounded-md bg-transparent font-display text-base font-bold text-heading outline-none"
        aria-label={t("board.column.title")}
      />
      <div className="mt-3 flex flex-col gap-2.5">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              marked={markedCardIds?.has(card.id) ?? false}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onEdit={onEditCard}
              onTouch={onTouchCard}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="rounded-[11px] border border-dashed border-line-strong px-3 py-3 text-center text-xs font-semibold text-muted">
            {t("board.drop")}
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
