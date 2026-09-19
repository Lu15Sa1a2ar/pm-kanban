import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cardCountLabel, DEFAULT_LANGUAGE, I18nProvider, LANGUAGE_KEY, storedLanguage, translate, translations, useI18n, type Translate } from "@/lib/i18n";

const LanguageProbe = () => {
  const { language, setLanguage, t } = useI18n();
  return (
    <div>
      <span>{language}</span>
      <span>{t("entry.signin")}</span>
      <span>{t("board.session", { minutes: 12 })}</span>
      <button onClick={() => setLanguage("es")} type="button">
        Español
      </button>
    </div>
  );
};

describe("i18n", () => {
  it("switches the interface dictionary from English to Spanish", async () => {
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>
    );

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Demo session · 12 min left")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Español" }));

    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
    expect(screen.getByText("Sesión de demo · quedan 12 min")).toBeInTheDocument();
    expect(screen.getByText("es")).toBeInTheDocument();
  });

  it("has every key in both languages with a non-empty value", () => {
    const englishKeys = Object.keys(translations.en).sort();
    const spanishKeys = Object.keys(translations.es).sort();
    expect(spanishKeys).toEqual(englishKeys);
    for (const language of ["en", "es"] as const) {
      for (const [key, value] of Object.entries(translations[language])) {
        expect(value, `${language}.${key}`).not.toBe("");
      }
    }
  });

  it("uses the same placeholders in both languages", () => {
    const placeholders = (value: string) => (value.match(/\{\w+\}/g) || []).sort();
    for (const key of Object.keys(translations.en) as (keyof typeof translations.en)[]) {
      expect(placeholders(translations.es[key]), key).toEqual(placeholders(translations.en[key]));
    }
  });

  it("interpolates parameters and leaves unknown placeholders visible", () => {
    expect(translate("en", "copilot.counter", { used: 3, limit: 10 })).toBe("3 of 10");
    expect(translate("es", "footer.builtby", { name: "Luis" })).toBe("Hecho por Luis");
    expect(translate("en", "copilot.updated", {})).toBe("{count} cards updated on the board");
  });

  it("pluralises card counts", () => {
    const en: Translate = (key, params) => translate("en", key, params);
    const es: Translate = (key, params) => translate("es", key, params);
    expect(cardCountLabel(en, 0)).toBe("No cards");
    expect(cardCountLabel(en, 1)).toBe("1 card");
    expect(cardCountLabel(en, 4)).toBe("4 cards");
    expect(cardCountLabel(es, 0)).toBe("Sin tarjetas");
    expect(cardCountLabel(es, 1)).toBe("1 tarjeta");
    expect(cardCountLabel(es, 4)).toBe("4 tarjetas");
  });

  it("defaults to Spanish and honours a stored preference", async () => {
    expect(DEFAULT_LANGUAGE).toBe("es");
    window.localStorage.removeItem(LANGUAGE_KEY);
    expect(storedLanguage()).toBeNull();

    const { unmount } = render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>
    );
    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
    unmount();

    window.localStorage.setItem(LANGUAGE_KEY, "en");
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>
    );
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("stores the language chosen with the toggle", async () => {
    window.localStorage.setItem(LANGUAGE_KEY, "en");
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>
    );
    await userEvent.click(await screen.findByRole("button", { name: "Español" }));
    expect(window.localStorage.getItem(LANGUAGE_KEY)).toBe("es");
  });
});
