import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-[11px] border border-line bg-panel px-3 py-[11px] shadow-[0_12px_24px_rgba(16,42,67,0.16)]">
    <h4 className="text-sm font-semibold text-heading">{card.title}</h4>
    <p className="mt-1.5 text-[12.5px] leading-[1.45] text-support">{card.details}</p>
  </article>
);
