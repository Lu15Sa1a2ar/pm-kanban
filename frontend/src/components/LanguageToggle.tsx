"use client";

import clsx from "clsx";
import { useI18n, type Language } from "@/lib/i18n";

const languages: Language[] = ["en", "es"];

export const LanguageToggle = () => {
  const { language, setLanguage, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("entry.language")}
      className="inline-flex rounded-lg border border-line-outline p-0.5"
      data-testid="language-toggle"
    >
      {languages.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          aria-pressed={language === option}
          className={clsx(
            "min-w-[44px] rounded-md px-2.5 py-2 text-xs font-bold uppercase tracking-wide transition",
            language === option ? "bg-heading text-white" : "text-body hover:text-heading"
          )}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
