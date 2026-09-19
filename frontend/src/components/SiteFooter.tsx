"use client";

import { facts } from "@/lib/facts";
import { useI18n } from "@/lib/i18n";

const linkClass = "font-semibold text-link underline-offset-4 hover:underline";

export const SiteFooter = () => {
  const { t } = useI18n();
  const blocks = [
    { title: t("footer.frontend"), lines: [t("footer.frontend.1"), t("footer.frontend.2")] },
    {
      title: t("footer.backend"),
      lines: [t("footer.backend.1"), t("footer.backend.2", { tests: facts.automatedTests })],
    },
    { title: t("footer.data"), lines: [t("footer.data.1"), t("footer.data.2")] },
  ];

  return (
    <footer className="rounded-2xl border border-line bg-panel" data-testid="site-footer">
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="font-display text-base font-bold text-heading">
            {t("footer.builtby", { name: facts.authorName })}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-body">{t("footer.builtby.body")}</p>
          <p className="mt-3 flex gap-4 text-sm">
            <a className={linkClass} href={facts.linkedinUrl} target="_blank" rel="noopener noreferrer">
              {t("footer.linkedin")}
            </a>
            <a className={linkClass} href={facts.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t("footer.github")}
            </a>
          </p>
        </div>
        {blocks.map((block) => (
          <div key={block.title}>
            <p className="eyebrow text-muted">{block.title}</p>
            {block.lines.map((line) => (
              <p key={line} className="mt-1.5 text-sm leading-6 text-body">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-line px-5 py-3.5 text-xs text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <p>{t("footer.note")}</p>
        <p>
          {t("footer.perf", {
            load: facts.boardLoad,
            cold: facts.coldStart,
            limit: facts.copilotMessagesPerSession,
          })}
        </p>
      </div>
    </footer>
  );
};
