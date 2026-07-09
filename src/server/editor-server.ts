import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  DeskDoodleState,
  EditorBootstrap,
  ErrorResponse,
  SaveRequest,
  SaveResponse,
} from "../shared/types.js";
import { applyGnomeWallpaper } from "./gnome.js";
import { readLayerScene, writeLayerScene } from "./state.js";
import { compositeWallpaper, writeLayerPngFromDataUrl } from "./render.js";

export type EditorServer = {
  readonly url: string;
  readonly token: string;
  readonly close: () => Promise<void>;
};

export async function startEditorServer(
  state: DeskDoodleState,
  onExit: () => void,
): Promise<EditorServer> {
  const token = randomBytes(24).toString("base64url");
  const staticDir = resolve(
    fileURLToPath(new URL("../editor", import.meta.url)),
  );

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.searchParams.get("token") !== token && url.pathname.startsWith("/api/")) {
        sendJson(response, 403, { ok: false, error: "Invalid token." } satisfies ErrorResponse);
        return;
      }

      if (url.pathname === "/api/bootstrap") {
        const payload: EditorBootstrap = {
          token,
          baseUrl: `/base.png?token=${token}`,
          monitor: state.monitor,
          scene: await readLayerScene(state),
        };
        sendJson(response, 200, payload);
        return;
      }

      if (url.pathname === "/api/save" && request.method === "POST") {
        const body = await readRequestJson<SaveRequest>(request);
        await writeLayerScene(state, body.scene);
        await writeLayerPngFromDataUrl(body.layerPngDataUrl, state.paths.layerPngPath);
        await compositeWallpaper(
          state.paths.basePath,
          state.paths.layerPngPath,
          state.paths.renderedPath,
        );
        await applyGnomeWallpaper(state.paths.renderedPath);
        const payload: SaveResponse = { ok: true, renderedPath: state.paths.renderedPath };
        sendJson(response, 200, payload);
        onExit();
        return;
      }

      if (url.pathname === "/api/discard" && request.method === "POST") {
        sendJson(response, 200, { ok: true });
        onExit();
        return;
      }

      if (url.pathname === "/base.png") {
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
    close,
  };
}

async function sendStaticFile(
  response: ServerResponse,
  staticDir: string,
  pathname: string,
): Promise<void> {
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
}

async function sendFile(
  response: ServerResponse,
  path: string,
  contentType: string,
): Promise<void> {
  const data = await readFile(path);
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(data);
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function readRequestJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function contentTypeForPath(path: string): string {
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
}
