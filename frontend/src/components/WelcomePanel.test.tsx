import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WELCOME_SEEN_KEY, WelcomePanel } from "@/components/WelcomePanel";

describe("WelcomePanel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("renders on first entry as a labelled modal dialog", () => {
    render(<WelcomePanel />);

    const dialog = screen.getByRole("dialog", { name: "This board is yours for the next hour." });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Start using the board" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("does not render again within the same session", async () => {
    const first = render(<WelcomePanel />);
    await userEvent.click(screen.getByRole("button", { name: "Start using the board" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(WELCOME_SEEN_KEY)).toBe("1");
    first.unmount();

    render(<WelcomePanel />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<WelcomePanel />);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores focus to the previously focused element on close", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Trigger";
    document.body.appendChild(opener);
    opener.focus();

    render(<WelcomePanel />);
    expect(document.activeElement).not.toBe(opener);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("closes on a backdrop click but not on a click inside the panel", async () => {
    render(<WelcomePanel />);

    await userEvent.click(screen.getByRole("heading", { name: "This board is yours for the next hour." }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("welcome-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps Tab inside the dialog", async () => {
    render(<WelcomePanel />);
    const close = screen.getByRole("button", { name: "Close" });
    const source = screen.getByRole("link", { name: "Read the source" });

    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(source).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
  });
});
