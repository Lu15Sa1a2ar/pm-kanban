import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { COPILOT_MARK_MS, KanbanBoard } from "@/components/KanbanBoard";
import { chat, getBoard, saveBoard } from "@/lib/api";
import { initialData, type BoardData } from "@/lib/kanban";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
  chat: vi.fn(),
}));

// The seeded board with card-1 moved from Backlog to Done, as the copilot would return it.
const movedBoard: BoardData = {
  ...initialData,
  columns: initialData.columns.map((column) => {
    if (column.id === "col-backlog") {
      return { ...column, cardIds: column.cardIds.filter((id) => id !== "card-1") };
    }
    if (column.id === "col-done") {
      return { ...column, cardIds: [...column.cardIds, "card-1"] };
    }
    return column;
  }),
};

const emptiedBacklog: BoardData = {
  columns: initialData.columns.map((column) =>
    column.id === "col-backlog" ? { ...column, cardIds: [] } : column
  ),
  cards: Object.fromEntries(
    Object.entries(initialData.cards).filter(([id]) => !["card-1", "card-2"].includes(id))
  ),
};

const askCopilot = async (question: string) => {
  await userEvent.type(screen.getByLabelText("Ask about the board or request a card change"), question);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("KanbanBoard header pills", () => {
  beforeEach(() => {
    vi.mocked(saveBoard).mockResolvedValue(initialData);
  });

  it("shows the card count with the right grammar and mutes empty columns", async () => {
    vi.mocked(getBoard).mockResolvedValue(emptiedBacklog);
    render(<KanbanBoard remote />);

    const backlog = await screen.findByTestId("pill-col-backlog");
    expect(backlog).toHaveTextContent("No cards");
    expect(backlog).toHaveAttribute("data-empty", "true");
    expect(backlog).toHaveClass("text-muted");

    const discovery = screen.getByTestId("pill-col-discovery");
    expect(discovery).toHaveTextContent("1 card");
    expect(discovery).not.toHaveAttribute("data-empty");
    expect(discovery).toHaveClass("text-heading");

    expect(screen.getByTestId("pill-col-progress")).toHaveTextContent("2 cards");
  });

  it("shows the session countdown when an expiry is known", async () => {
    vi.mocked(getBoard).mockResolvedValue(initialData);
    render(<KanbanBoard remote sessionExpiresAt={Date.now() + 47 * 60_000} />);

    expect(await screen.findByTestId("session-countdown")).toHaveTextContent("47 min left");
  });
});

describe("KanbanBoard copilot marker", () => {
  beforeEach(() => {
    vi.mocked(getBoard).mockResolvedValue(initialData);
    vi.mocked(saveBoard).mockResolvedValue(initialData);
    vi.mocked(chat).mockResolvedValue({ response: "Moved it to Done.", board: movedBoard });
  });

  it("marks the cards the copilot changed and shows the summary strip", async () => {
    render(<KanbanBoard remote />);
    await screen.findByTestId("card-card-1");

    await askCopilot("Move Align roadmap themes to Done");

    const done = await screen.findByTestId("column-col-done");
    const moved = within(done).getByTestId("card-card-1");
    expect(moved).toHaveAttribute("data-marked", "true");
    expect(within(moved).getByText("Moved by the copilot")).toBeInTheDocument();
    expect(screen.getByTestId("card-card-2")).not.toHaveAttribute("data-marked");
    expect(screen.getByTestId("copilot-summary")).toHaveTextContent("1 card updated on the board");
    expect(screen.getByTestId("copilot-counter")).toHaveTextContent("1 of 10");
    // The copilot's board was saved by the backend; the frontend must not save it again.
    expect(saveBoard).not.toHaveBeenCalled();
  });

  it("clears the mark after the timeout", async () => {
    // Fake timers go in before the mark is scheduled; shouldAdvanceTime keeps
    // testing-library's own polling alive.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    try {
      render(<KanbanBoard remote />);
      await screen.findByTestId("card-card-1");
      await user.type(screen.getByLabelText("Ask about the board or request a card change"), "Move it");
      await user.click(screen.getByRole("button", { name: "Send" }));
      expect(await screen.findByText("Moved by the copilot")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(COPILOT_MARK_MS);
      });

      expect(screen.queryByText("Moved by the copilot")).not.toBeInTheDocument();
      expect(screen.getByTestId("card-card-1")).not.toHaveAttribute("data-marked");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the mark as soon as the user touches the card", async () => {
    render(<KanbanBoard remote />);
    await screen.findByTestId("card-card-1");
    await askCopilot("Move Align roadmap themes to Done");
    const moved = await screen.findByTestId("card-card-1");
    expect(moved).toHaveAttribute("data-marked", "true");

    await userEvent.pointer({ keys: "[MouseLeft>]", target: moved });

    expect(moved).not.toHaveAttribute("data-marked");
  });
});
