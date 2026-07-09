import type {
  ApplyWorkspaceRequest,
  ApplyWorkspaceResponse,
  EditorWorkspace,
} from "../shared/types";
import { apiRoutes } from "../shared/api";

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

export const applyWorkspace = async (
  token: string,
  request: ApplyWorkspaceRequest,
): Promise<ApplyWorkspaceResponse> => {
  const response = await fetch(withToken(apiRoutes.applyWorkspace, token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Apply failed: ${response.status}`);
  }
  return response.json() as Promise<ApplyWorkspaceResponse>;
};

export const closeSession = async (token: string): Promise<void> => {
  await fetch(withToken(apiRoutes.session, token), { method: "DELETE" });
};

export const sessionCloseUrl = (token: string): string => {
  return withToken(apiRoutes.session, token);
};

const withToken = (path: string, token: string): string => {
  return `${path}?token=${encodeURIComponent(token)}`;
};
