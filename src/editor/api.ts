import { apiRoutes, type ApplyRequest, type EditorWorkspace } from "../shared/protocol";

export const readToken = (): string => {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    throw new Error("Missing DeskDoodle session token.");
  }
  return token;
};

export const fetchEditorWorkspace = async (token: string): Promise<EditorWorkspace> => {
  const response = await fetch(withToken(apiRoutes.workspace, token));
  if (!response.ok) {
    throw new Error(`Workspace load failed: ${response.status}`);
  }
  return response.json() as Promise<EditorWorkspace>;
};

export const applyWorkspace = async (token: string, request: ApplyRequest): Promise<void> => {
  const response = await fetch(withToken(apiRoutes.applyWorkspace, token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Apply failed: ${response.status}`);
  }
};

/** `keepalive` lets the request outlive the page being torn down on `pagehide`. */
export const closeSession = (token: string, keepalive = false): Promise<unknown> => {
  return fetch(withToken(apiRoutes.session, token), { method: "DELETE", keepalive });
};

const withToken = (path: string, token: string): string => {
  return `${path}?token=${encodeURIComponent(token)}`;
};
