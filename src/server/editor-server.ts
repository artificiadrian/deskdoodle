import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { apiRoutes, type EditorWorkspace, type ErrorResponse } from "../shared/protocol";
import type { Paths } from "./paths";
import type { WallpaperProvider } from "./providers/wallpaper/index";
import { compositeWallpaper, writeLayerPng } from "./render";
import { readLayerScene, writeLayerScene, type State } from "./state";

/** How an editor session ended. Only `saved` changes the wallpaper. */
export type SessionOutcome =
  | { readonly kind: "saved" }
  | { readonly kind: "canceled" }
  | { readonly kind: "closed" }
  | { readonly kind: "failed"; readonly message: string };

export type EditorServer = {
  readonly url: string;
  /** Resolves the first time the editor saves, cancels, or errors. */
  readonly finished: Promise<SessionOutcome>;
  readonly close: () => Promise<void>;
};

export type EditorServerDeps = {
  readonly state: State;
  readonly wallpaper: WallpaperProvider;
  readonly paths: Paths;
};

const maxBodyBytes = 64 * 1024 * 1024;

const applyRequestSchema = z.object({
  scene: z.record(z.string(), z.unknown()),
  layerPngBase64: z.string(),
});

export const startEditorServer = async (deps: EditorServerDeps): Promise<EditorServer> => {
  const { state, wallpaper, paths } = deps;
  const token = randomBytes(24).toString("base64url");
  const staticDir = resolve(fileURLToPath(new URL("../editor", import.meta.url)));

  let settle: ((outcome: SessionOutcome) => void) | null = null;
  const finished = new Promise<SessionOutcome>((resolveFinished) => {
    settle = resolveFinished;
  });

  /** First outcome wins; later ones are noise from a shutting-down browser. */
  const finish = (outcome: SessionOutcome): void => {
    settle?.(outcome);
    settle = null;
  };

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    // Covers every /api/ route, the base image included.
    if (url.pathname.startsWith("/api/") && url.searchParams.get("token") !== token) {
      sendJson(response, 403, { ok: false, error: "Invalid token." } satisfies ErrorResponse);
      return;
    }

    if (url.pathname === apiRoutes.workspace && request.method === "GET") {
      const payload: EditorWorkspace = {
        baseImageUrl: withToken(apiRoutes.baseImage, token),
        monitor: state.monitor,
        scene: await readLayerScene(paths),
      };
      sendJson(response, 200, payload);
      return;
    }

    if (url.pathname === apiRoutes.applyWorkspace && request.method === "POST") {
      const body = applyRequestSchema.parse(await readRequestJson(request));
      await writeLayerScene(paths, body.scene);
      await writeLayerPng(body.layerPngBase64, paths.layerPngPath);
      await compositeWallpaper(paths.basePath, paths.layerPngPath, paths.renderedPath);
      await wallpaper.apply(paths.renderedPath);
      sendNoContent(response);
      finish({ kind: "saved" });
      return;
    }

    if (url.pathname === apiRoutes.session && request.method === "DELETE") {
      sendNoContent(response);
      finish({ kind: "canceled" });
      return;
    }

    if (url.pathname === apiRoutes.baseImage) {
      await sendFile(response, paths.basePath, "image/png");
      return;
    }

    await sendStaticFile(response, staticDir, url.pathname === "/" ? "/index.html" : url.pathname);
  };

  const server = createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(response, 500, { ok: false, error: message } satisfies ErrorResponse);
      if (new URL(request.url ?? "/", "http://127.0.0.1").pathname.startsWith("/api/")) {
        finish({ kind: "failed", message });
      }
    });
  });

  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start the DeskDoodle editor server.");
  }

  const close = async (): Promise<void> => {
    // An unmanaged browser (xdg-open) holds its keep-alive socket open, and close()
    // alone would wait for that socket to time out.
    server.closeIdleConnections();
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  };

  return { url: `http://127.0.0.1:${address.port}/?token=${token}`, finished, close };
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
  if (requestedPath !== staticDir && !requestedPath.startsWith(staticDir + sep)) {
    sendJson(response, 403, { ok: false, error: "Forbidden." } satisfies ErrorResponse);
    return;
  }

  try {
    await sendFile(response, requestedPath, contentTypeForPath(requestedPath));
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
  response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(data);
};

const sendJson = (response: ServerResponse, status: number, value: unknown): void => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
};

const sendNoContent = (response: ServerResponse): void => {
  response.writeHead(204, { "Cache-Control": "no-store" });
  response.end();
};

const readRequestJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
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
