import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, useI18n } from "@/lib/i18n";

const LanguageProbe = () => {
  const { language, setLanguage, t } = useI18n();
  return (
    <div>
      <span>{language}</span>
      <span>{t("signIn")}</span>
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
    await userEvent.click(screen.getByRole("button", { name: "Español" }));

    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
    expect(screen.getByText("es")).toBeInTheDocument();
  });
});