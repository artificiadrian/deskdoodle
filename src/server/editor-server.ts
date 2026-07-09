import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ApplyWorkspaceRequest,
  ApplyWorkspaceResponse,
  DeskDoodleState,
  EditorWorkspace,
  ErrorResponse,
} from "../shared/types";
import { apiRoutes } from "../shared/api";
import { parsePngDataUrl } from "../shared/data-url";
import { readLayerScene, writeLayerScene } from "./state";
import { compositeWallpaper, writeLayerPngFromDataUrl } from "./render";
import type { WallpaperProvider } from "./providers/wallpaper/index";

export type EditorServer = {
  readonly url: string;
  readonly token: string;
  readonly result: () => EditorSessionResult;
  readonly closeAs: (result: FinishedEditorSessionResult) => void;
  readonly close: () => Promise<void>;
};

export type EditorSessionResult =
  | { readonly kind: "open" }
  | { readonly kind: "saved"; readonly renderedPath: string }
  | { readonly kind: "canceled" }
  | { readonly kind: "closed" }
  | { readonly kind: "failed"; readonly message: string };

export type FinishedEditorSessionResult = Exclude<EditorSessionResult, { readonly kind: "open" }>;

export const startEditorServer = async (
  state: DeskDoodleState,
  wallpaper: WallpaperProvider,
  onExit: () => void,
): Promise<EditorServer> => {
  const token = randomBytes(24).toString("base64url");
  let result: EditorSessionResult = { kind: "open" };
  const staticDir = resolve(
    fileURLToPath(new URL("../editor", import.meta.url)),
  );

  const closeAs = (nextResult: FinishedEditorSessionResult): void => {
    if (result.kind !== "open") {
      return;
    }
    result = nextResult;
    onExit();
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (url.searchParams.get("token") !== token && url.pathname.startsWith("/api/")) {
        sendJson(response, 403, { ok: false, error: "Invalid token." } satisfies ErrorResponse);
        return;
      }

      if (url.pathname === apiRoutes.workspace && request.method === "GET") {
        const payload: EditorWorkspace = {
          baseImageUrl: withToken(apiRoutes.baseImage, token),
          monitor: state.monitor,
          scene: await readLayerScene(state),
        };
        sendJson(response, 200, payload);
        return;
      }

      if (url.pathname === apiRoutes.applyWorkspace && request.method === "POST") {
        const body = parseApplyWorkspaceRequest(await readRequestJson(request));
        await writeLayerScene(state, body.scene);
        await writeLayerPngFromDataUrl(body.layerPngDataUrl, state.paths.layerPngPath);
        await compositeWallpaper(
          state.paths.basePath,
          state.paths.layerPngPath,
          state.paths.renderedPath,
        );
        await wallpaper.apply(state.paths.renderedPath);
        const payload: ApplyWorkspaceResponse = { ok: true, renderedPath: state.paths.renderedPath };
        sendJson(response, 200, payload);
        closeAs({ kind: "saved", renderedPath: state.paths.renderedPath });
        return;
      }

      if (url.pathname === apiRoutes.session && request.method === "DELETE") {
        sendJson(response, 200, { ok: true });
        closeAs({ kind: "canceled" });
        return;
      }

      if (url.pathname === apiRoutes.baseImage) {
        if (url.searchParams.get("token") !== token) {
          sendJson(response, 403, { ok: false, error: "Invalid token." } satisfies ErrorResponse);
          return;
        }
        await sendFile(response, state.paths.basePath, "image/png");
        return;
      }

      const staticPath = url.pathname === "/" ? "/index.html" : url.pathname;
      await sendStaticFile(response, staticDir, staticPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(response, 500, { ok: false, error: message } satisfies ErrorResponse);
      if (url.pathname.startsWith("/api/")) {
        closeAs({ kind: "failed", message });
      }
    }
  });

  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start DeskDoodle editor server.");
  }

  const close = async (): Promise<void> => {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }
        resolveClose();
      });
    });
  };

  return {
    url: `http://127.0.0.1:${address.port}/?token=${token}`,
    token,
    result: () => result,
    closeAs,
    close,
  };
};

const withToken = (path: string, token: string): string => {
  return `${path}?token=${encodeURIComponent(token)}`;
};

const sendStaticFile = async (
  response: ServerResponse,
  staticDir: string,
  pathname: string,
): Promise<void> => {
  const requestedPath = resolve(join(staticDir, pathname));
  if (!requestedPath.startsWith(staticDir)) {
    sendJson(response, 403, { ok: false, error: "Forbidden." } satisfies ErrorResponse);
    return;
  }

  const contentType = contentTypeForPath(requestedPath);
  try {
    await sendFile(response, requestedPath, contentType);
  } catch {
    await sendFile(response, join(staticDir, "index.html"), "text/html; charset=utf-8");
  }
};

const sendFile = async (
  response: ServerResponse,
  path: string,
  contentType: string,
): Promise<void> => {
  const data = await readFile(path);
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(data);
};

const sendJson = (response: ServerResponse, status: number, value: unknown): void => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
};

const readRequestJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
};

const parseApplyWorkspaceRequest = (value: unknown): ApplyWorkspaceRequest => {
  if (!isRecord(value)) {
    throw new Error("Expected save request object.");
  }

  if (!isRecord(value.scene)) {
    throw new Error("Expected Excalidraw scene object.");
  }

  return {
    scene: value.scene,
    layerPngDataUrl: parsePngDataUrl(value.layerPngDataUrl),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const contentTypeForPath = (path: string): string => {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
};
