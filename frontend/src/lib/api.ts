import type { BoardData } from "@/lib/kanban";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail || "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
};

export const login = (username: string, password: string) =>
  request<{ username: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const logout = () => request<void>("/api/auth/logout", { method: "POST" });

export const getCurrentUser = () =>
  request<{ username: string }>("/api/me");

export const getBoard = () => request<BoardData>("/api/board");

export const saveBoard = (board: BoardData) =>
  request<BoardData>("/api/board", {
    method: "PUT",
    body: JSON.stringify(board),
  });

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const chat = (question: string, history: ChatMessage[]) =>
  request<{ response: string; board: BoardData | null }>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ question, history }),
  });