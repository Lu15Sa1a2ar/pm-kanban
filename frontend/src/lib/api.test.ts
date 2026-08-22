import { getBoard, saveBoard } from "@/lib/api";
import { initialData } from "@/lib/kanban";

describe("API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the authenticated board with same-origin credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    await expect(getBoard()).resolves.toEqual(initialData);

    expect(fetchMock).toHaveBeenCalledWith("/api/board", {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("serializes board updates and exposes API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid board" }), { status: 422 })
    );

    await expect(saveBoard(initialData)).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "Invalid board",
    });
  });
});
