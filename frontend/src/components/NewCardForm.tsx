import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n";

const initialFormState = { title: "", details: "" };

type NewCardFormProps = {
  onAdd: (title: string, details: string) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    onAdd(formState.title.trim(), formState.details.trim());
    setFormState(initialFormState);
    setIsOpen(false);
  };

  return (
    <div className="mt-3">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder={t("card.title")}
            className="w-full rounded-lg border border-line-strong bg-panel px-3 py-2 text-sm font-medium text-heading outline-none transition placeholder:text-muted-soft focus:border-primary"
            required
          />
          <textarea
            value={formState.details}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, details: event.target.value }))
            }
            placeholder={t("card.details")}
            rows={3}
            className="w-full resize-none rounded-lg border border-line-strong bg-panel px-3 py-2 text-sm text-body outline-none transition placeholder:text-muted-soft focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110 active:scale-[0.98] active:brightness-95"
            >
              {t("board.add")}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="rounded-lg border border-line-outline px-3 py-2 text-xs font-semibold text-body transition hover:text-heading"
            >
              {t("card.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-link transition hover:bg-page"
        >
          + {t("board.add")}
        </button>
      )}
    </div>
  );
};
