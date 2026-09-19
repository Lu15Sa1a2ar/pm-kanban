import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("edits a card title with a double click", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();

    await userEvent.dblClick(within(column).getByText("Align roadmap themes"));
    const input = within(column).getByLabelText("Edit card title");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed by double click{Enter}");

    expect(within(column).getByText("Renamed by double click")).toBeInTheDocument();
    expect(within(column).queryByLabelText("Edit card title")).not.toBeInTheDocument();
  });

  it("edits card details with a double click and discards changes on escape", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const originalDetails =
      "Draft quarterly themes with impact statements and metrics.";

    await userEvent.dblClick(within(column).getByText(originalDetails));
    const textarea = within(column).getByLabelText("Edit card details");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Updated details.");
    await userEvent.tab();

    expect(within(column).getByText("Updated details.")).toBeInTheDocument();

    await userEvent.dblClick(within(column).getByText("Updated details."));
    const reopened = within(column).getByLabelText("Edit card details");
    await userEvent.clear(reopened);
    await userEvent.type(reopened, "Discarded text{Escape}");

    expect(within(column).getByText("Updated details.")).toBeInTheDocument();
    expect(within(column).queryByText("Discarded text")).not.toBeInTheDocument();
  });

  it("keeps the original title when the edit is left empty", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();

    await userEvent.dblClick(within(column).getByText("Align roadmap themes"));
    const input = within(column).getByLabelText("Edit card title");
    await userEvent.clear(input);
    await userEvent.tab();

    expect(within(column).getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(
      within(column).getByRole("button", { name: /add( a)? card/i })
    );

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /remove new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });
});

describe("KanbanBoard cards without notes", () => {
  it("offers an editable placeholder when a card has no details", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();

    // Empty the details first, as a copilot-created card would arrive.
    await userEvent.dblClick(within(column).getByText("Draft quarterly themes with impact statements and metrics."));
    await userEvent.clear(within(column).getByLabelText("Edit card details"));
    await userEvent.tab();

    const placeholder = within(column).getByText("Double-click to add notes");
    await userEvent.dblClick(placeholder);
    await userEvent.type(within(column).getByLabelText("Edit card details"), "Notes added later.");
    await userEvent.tab();

    expect(within(column).getByText("Notes added later.")).toBeInTheDocument();
    expect(within(column).queryByText("Double-click to add notes")).not.toBeInTheDocument();
  });
});
