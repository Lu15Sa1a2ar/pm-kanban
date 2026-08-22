import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { chat } from "@/lib/api";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", () => ({
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
});
