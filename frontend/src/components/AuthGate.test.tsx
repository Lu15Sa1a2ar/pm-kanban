import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { getBoard, getCurrentUser, login, loginAsGuest, logout, saveBoard } from "@/lib/api";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  loginAsGuest: vi.fn(),
  logout: vi.fn(),
  getBoard: vi.fn(),
  saveBoard: vi.fn(),
}));

describe("AuthGate", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("signed out"));
    vi.mocked(login).mockResolvedValue({ username: "user" });
    vi.mocked(loginAsGuest).mockResolvedValue({ username: "guest-abc" });
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

  it("enters the board as a guest without credentials", async () => {
    render(<AuthGate />);

    await screen.findByText(/your demo session lasts one hour/i);
    await userEvent.click(screen.getByRole("button", { name: "Try the demo" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(loginAsGuest).toHaveBeenCalledOnce();
  });

  it("shows an error when the demo cannot start", async () => {
    vi.mocked(loginAsGuest).mockRejectedValueOnce(new Error("down"));
    render(<AuthGate />);

    await userEvent.click(await screen.findByRole("button", { name: "Try the demo" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to start the demo.");
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

describe("AuthGate entry screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.mocked(getCurrentUser).mockRejectedValue(new Error("signed out"));
    vi.mocked(login).mockResolvedValue({ username: "user" });
    vi.mocked(loginAsGuest).mockResolvedValue({ username: "guest-abc" });
    vi.mocked(getBoard).mockResolvedValue(initialData);
  });

  it("renders the content column and the access card", async () => {
    render(<AuthGate />);

    const content = await screen.findByTestId("entry-content");
    expect(within(content).getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(within(content).getByRole("link", { name: "Read the source" })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com")
    );

    const access = screen.getByTestId("entry-access");
    expect(within(access).getByRole("heading", { name: "Start in one tap" })).toBeInTheDocument();
    expect(within(access).getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(within(access).getByRole("button", { name: "Try the demo" })).toBeInTheDocument();
    expect(within(access).getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("posts the typed credentials when signing in", async () => {
    render(<AuthGate />);

    await userEvent.type(await screen.findByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(login).toHaveBeenCalledWith("user", "password");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("session-countdown")).not.toBeInTheDocument();
  });

  it("shows the welcome panel once per session after entering as a guest", async () => {
    const first = render(<AuthGate />);
    await userEvent.click(await screen.findByRole("button", { name: "Try the demo" }));
    expect(loginAsGuest).toHaveBeenCalledOnce();
    expect(await screen.findByRole("dialog", { name: "This board is yours for the next hour." })).toBeInTheDocument();
    expect(await screen.findByTestId("session-countdown")).toHaveTextContent("60 min left");

    await userEvent.click(screen.getByRole("button", { name: "Start using the board" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    // A reload in the same tab: the session is restored, the panel stays closed, the countdown continues.
    vi.mocked(getCurrentUser).mockResolvedValue({ username: "guest-abc" });
    render(<AuthGate />);
    await screen.findByRole("button", { name: "Log out" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("session-countdown")).toHaveTextContent("60 min left");
  });
});
