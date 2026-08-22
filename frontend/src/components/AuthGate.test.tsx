import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { getBoard, getCurrentUser, login, logout, saveBoard } from "@/lib/api";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
}));

describe("AuthGate", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("signed out"));
    vi.mocked(login).mockResolvedValue({ username: "user" });
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.mocked(getBoard).mockResolvedValue(initialData);
    vi.mocked(saveBoard).mockResolvedValue(initialData);
  });

  it("rejects invalid credentials", async () => {
    render(<AuthGate />);

    await screen.findByLabelText("Username");
    await userEvent.type(screen.getByLabelText("Username"), "wrong");
    await userEvent.type(screen.getByLabelText("Password"), "credentials");
    vi.mocked(login).mockRejectedValueOnce(new Error("invalid credentials"));
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid username or password."
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("signs in, persists the session, and logs out", async () => {
    render(<AuthGate />);

    await screen.findByLabelText("Username");
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
    );
    expect(logout).toHaveBeenCalledOnce();
  });

  it("restores an existing session", () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: "user" });

    render(<AuthGate />);

    return waitFor(() => {
      expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
      expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
    });
  });
});
