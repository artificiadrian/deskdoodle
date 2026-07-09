import type { EditorBootstrap, SaveRequest, SaveResponse } from "../shared/types.js";

export function readToken(): string {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    throw new Error("Missing DeskDoodle session token.");
  }
  return token;
}

export async function fetchBootstrap(token: string): Promise<EditorBootstrap> {
  const response = await fetch(`/api/bootstrap?token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new Error(`Bootstrap failed: ${response.status}`);
  }
  return response.json() as Promise<EditorBootstrap>;
}

export async function saveWallpaper(
  token: string,
  request: SaveRequest,
): Promise<SaveResponse> {
  const response = await fetch(`/api/save?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Save failed: ${response.status}`);
  }
  return response.json() as Promise<SaveResponse>;
}

export async function discardSession(token: string): Promise<void> {
  await fetch(`/api/discard?token=${encodeURIComponent(token)}`, { method: "POST" });
}
