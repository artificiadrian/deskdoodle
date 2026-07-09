/**
 * Wire contract between the editor server and the browser editor.
 *
 * Deliberately free of Excalidraw types: the server stores the scene without
 * interpreting it, so only the editor needs to know its real shape.
 */

export const apiRoutes = {
  workspace: "/api/workspace",
  baseImage: "/api/workspace/base-image",
  applyWorkspace: "/api/workspace/apply",
  session: "/api/session",
} as const;

export type Monitor = {
  readonly name: string;
  readonly width: number;
  readonly height: number;
};

/** An Excalidraw scene, opaque to the server. The editor casts it at its own boundary. */
export type SceneJson = Record<string, unknown>;

export type EditorWorkspace = {
  readonly baseImageUrl: string;
  readonly monitor: Monitor;
  readonly scene: SceneJson | null;
};

export type ApplyRequest = {
  readonly scene: SceneJson;
  /** The doodle layer as base64-encoded PNG bytes. */
  readonly layerPngBase64: string;
};

export type ErrorResponse = {
  readonly ok: false;
  readonly error: string;
};
