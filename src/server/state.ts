import { mkdir } from "node:fs/promises";
import type { DeskDoodleState, ExcalidrawSceneFile } from "../shared/types";
import { readJson, removeIfExists, writeJson } from "./files";
import { getPaths } from "./paths";
import { renderBaseWallpaper } from "./render";
import {
  resolveWallpaperProviderForState,
  type WallpaperProvider,
} from "./providers/wallpaper/index";

export type PreparedState = {
  readonly state: DeskDoodleState;
  readonly wallpaper: WallpaperProvider;
};

export const prepareState = async (wallpaper: WallpaperProvider): Promise<PreparedState> => {
  const paths = getPaths();
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(paths.runtimeDir, { recursive: true });

  const existing = parseStoredState(await readJson<unknown>(paths.statePath));
  if (existing) {
    return {
      state: existing,
      wallpaper: resolveWallpaperProviderForState(existing),
    };
  }

  const capture = await wallpaper.capture();

  await renderBaseWallpaper(capture.baseSourcePath, paths.basePath, capture.monitor);

  const state: DeskDoodleState = {
    version: 2,
    backend: capture.backend,
    restoreTarget: capture.restoreTarget,
    baseSourceUri: capture.baseSourceUri,
    pictureOptions: capture.pictureOptions,
    monitor: capture.monitor,
    paths,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(paths.statePath, state);
  return { state, wallpaper };
};

export const readLayerScene = async (
  state: DeskDoodleState,
): Promise<ExcalidrawSceneFile | null> => {
  return readJson<ExcalidrawSceneFile>(state.paths.layerPath);
};

export const writeLayerScene = async (
  state: DeskDoodleState,
  scene: ExcalidrawSceneFile,
): Promise<void> => {
  await writeJson(state.paths.layerPath, {
    ...scene,
    type: "excalidraw",
    source: "deskdoodle",
  });
};

export const clearLayerFiles = async (state: DeskDoodleState): Promise<void> => {
  await Promise.all([
    removeIfExists(state.paths.layerPath),
    removeIfExists(state.paths.layerPngPath),
    removeIfExists(state.paths.renderedPath),
  ]);
};

const parseStoredState = (value: unknown): DeskDoodleState | null => {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error("Invalid DeskDoodle state: expected object.");
  }

  if (value.version === 2) {
    return parseStateV2(value);
  }

  throw new Error(`Invalid DeskDoodle state: unsupported version ${String(value.version)}.`);
};

const parseStateV2 = (value: Record<string, unknown>): DeskDoodleState => {
  if (!isRecord(value.backend) || value.backend.kind !== "gnome") {
    throw new Error("Invalid DeskDoodle state: unsupported backend.");
  }
  if (!isRecord(value.restoreTarget) || value.restoreTarget.kind !== "gnome") {
    throw new Error("Invalid DeskDoodle state: unsupported restore target.");
  }
  if (!isMonitor(value.monitor)) {
    throw new Error("Invalid DeskDoodle state: invalid monitor.");
  }
  if (!isPaths(value.paths)) {
    throw new Error("Invalid DeskDoodle state: invalid paths.");
  }

  return {
    version: 2,
    backend: { kind: "gnome" },
    restoreTarget: {
      kind: "gnome",
      pictureUri: stringField(value.restoreTarget, "pictureUri"),
      pictureUriDark: stringField(value.restoreTarget, "pictureUriDark"),
    },
    baseSourceUri: stringField(value, "baseSourceUri"),
    pictureOptions: stringField(value, "pictureOptions"),
    monitor: value.monitor,
    paths: value.paths,
    updatedAt: stringField(value, "updatedAt"),
  };
};

const stringField = (value: Record<string, unknown>, field: string): string => {
  const fieldValue = value[field];
  if (typeof fieldValue !== "string") {
    throw new Error(`Invalid DeskDoodle state: expected string field ${field}.`);
  }
  return fieldValue;
};

const isMonitor = (value: unknown): value is DeskDoodleState["monitor"] => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.scale === "number" &&
    typeof value.primary === "boolean"
  );
};

const isPaths = (value: unknown): value is DeskDoodleState["paths"] => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.dataDir === "string" &&
    typeof value.basePath === "string" &&
    typeof value.layerPath === "string" &&
    typeof value.layerPngPath === "string" &&
    typeof value.renderedPath === "string" &&
    typeof value.statePath === "string" &&
    typeof value.runtimeDir === "string"
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
