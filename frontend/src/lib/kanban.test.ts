import { diffBoards, moveCard, type BoardData, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

describe("diffBoards", () => {
  const board: BoardData = {
    columns: [
      { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
      { id: "col-b", title: "B", cardIds: ["card-3"] },
    ],
    cards: {
      "card-1": { id: "card-1", title: "One", details: "" },
      "card-2": { id: "card-2", title: "Two", details: "" },
      "card-3": { id: "card-3", title: "Three", details: "" },
    },
  };

  it("returns nothing when the boards match", () => {
    expect(diffBoards(board, structuredClone(board))).toEqual([]);
  });

  it("returns exactly the added, moved and edited cards", () => {
    const next: BoardData = {
      columns: [
        { id: "col-a", title: "A", cardIds: ["card-4", "card-1"] },
        { id: "col-b", title: "B", cardIds: ["card-3", "card-2"] },
      ],
      cards: {
        ...board.cards,
        "card-3": { id: "card-3", title: "Three", details: "Edited" },
        "card-4": { id: "card-4", title: "Four", details: "" },
      },
    };

    expect(diffBoards(board, next).sort()).toEqual(["card-2", "card-3", "card-4"]);
  });

  it("does not count neighbours shifted by an insertion or a deletion", () => {
    const inserted: BoardData = {
      ...board,
      columns: [{ id: "col-a", title: "A", cardIds: ["card-9", "card-1", "card-2"] }, board.columns[1]],
      cards: { ...board.cards, "card-9": { id: "card-9", title: "Nine", details: "" } },
    };
    expect(diffBoards(board, inserted)).toEqual(["card-9"]);

    const deleted: BoardData = {
      columns: [{ id: "col-a", title: "A", cardIds: ["card-2"] }, board.columns[1]],
      cards: { "card-2": board.cards["card-2"], "card-3": board.cards["card-3"] },
    };
    expect(diffBoards(board, deleted)).toEqual([]);
  });

  it("counts a reorder inside a column as a move", () => {
    const reordered: BoardData = {
      ...board,
      columns: [{ id: "col-a", title: "A", cardIds: ["card-2", "card-1"] }, board.columns[1]],
    };
    expect(diffBoards(board, reordered).sort()).toEqual(["card-1", "card-2"]);
  });
});
