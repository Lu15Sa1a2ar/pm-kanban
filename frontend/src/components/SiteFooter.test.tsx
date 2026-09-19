import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/SiteFooter";
import { facts } from "@/lib/facts";

describe("SiteFooter", () => {
  it("renders the author, the links and the measured numbers from one constant", () => {
    render(<SiteFooter />);

    expect(screen.getByText(`Built by ${facts.authorName}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", facts.linkedinUrl);
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", facts.sourceUrl);
    expect(screen.getByText(new RegExp(`${facts.automatedTests} automated tests`))).toBeInTheDocument();
    expect(
      screen.getByText(
        `${facts.boardLoad} to load a board · ${facts.coldStart} cold start · ${facts.copilotMessagesPerSession} copilot messages per session`
      )
    ).toBeInTheDocument();
  });
});
