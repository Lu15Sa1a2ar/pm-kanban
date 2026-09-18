import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { ApiError, chat } from "@/lib/api";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  chat: vi.fn(),
}));

describe("AIChatSidebar", () => {
  beforeEach(() => {
    vi.mocked(chat).mockResolvedValue({
      response: "The first column is now Ideas.",
      board: {
        ...initialData,
        columns: [{ ...initialData.columns[0], title: "Ideas" }, ...initialData.columns.slice(1)],
      },
    });
  });

  it("sends a question and applies a structured board update", async () => {
    const onBoardUpdate = vi.fn();
    render(<AIChatSidebar onBoardUpdate={onBoardUpdate} />);

    await userEvent.type(screen.getByLabelText("AI question"), "Rename the first column");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("The first column is now Ideas.")).toBeInTheDocument();
    expect(chat).toHaveBeenCalledWith("Rename the first column", []);
    expect(onBoardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ columns: expect.arrayContaining([expect.objectContaining({ title: "Ideas" })]) })
    );
  });

  it("tells the user when the AI message limit is reached", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new ApiError(429, "ai_session_limit"));
    render(<AIChatSidebar onBoardUpdate={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("AI question"), "One more");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("You have reached the AI message limit for this session.")
    ).toBeInTheDocument();
  });

  it("tells the user when the daily AI budget is exhausted", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new ApiError(429, "ai_daily_limit"));
    render(<AIChatSidebar onBoardUpdate={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("AI question"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("The AI assistant has reached its daily limit. Try again tomorrow.")
    ).toBeInTheDocument();
  });

  it("shows a generic error for other failures", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new ApiError(502, "bad gateway"));
    render(<AIChatSidebar onBoardUpdate={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("AI question"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Unable to reach the AI assistant.")).toBeInTheDocument();
  });
});
