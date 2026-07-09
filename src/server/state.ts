import { mkdir } from "node:fs/promises";
import { z } from "zod";
import type { Monitor, SceneJson } from "../shared/protocol";
import { pathExists, readJson, removeIfExists, writeJson } from "./files";
import { getPaths, isInsideDir, type Paths } from "./paths";
import {
  providerForKind,
  wallpaperKinds,
  type WallpaperKind,
  type WallpaperProvider,
} from "./providers/wallpaper/index";
import { renderBaseWallpaper } from "./render";

const monitorSchema = z.object({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const stateSchema = z.object({
  version: z.literal(3),
  backend: z.enum(wallpaperKinds),
  restore: z.unknown(),
  monitor: monitorSchema,
  baseSource: z.string(),
});

const sceneSchema = z.record(z.string(), z.unknown());

/** Everything that cannot be recreated from the desktop once we have overwritten the wallpaper. */
export type State = {
  readonly version: 3;
  readonly backend: WallpaperKind;
  /** Opaque restore blob, owned and parsed by `backend`'s provider. */
  readonly restore: unknown;
  readonly monitor: Monitor;
  /** The original wallpaper, so the base image can be rebuilt if the monitor changes. */
  readonly baseSource: string;
};

export type PreparedState = {
  readonly state: State;
  readonly wallpaper: WallpaperProvider;
};

/**
 * Loads the saved session, or creates one by capturing the desktop's current wallpaper.
 * The saved session pins its provider: only that provider can read its restore blob.
 */
export const prepareState = async (selected: WallpaperProvider): Promise<PreparedState> => {
  const paths = getPaths();
  await mkdir(paths.runtimeDir, { recursive: true });

  const existing = await readState(paths);
  if (existing) {
    const wallpaper = providerForKind(existing.backend);
    return { state: await syncBaseImage(existing, wallpaper, paths), wallpaper };
  }

  const capture = await selected.capture();

  // Without state.json the desktop's current wallpaper is our only source for the base
  // image and the restore target. If that wallpaper is one we generated, the original is
  // already unreachable: capturing would bake the doodles into base.png and leave
  // `restore` pointing at a doodled image.
  if (isInsideDir(paths.dataDir, capture.sourcePath)) {
    throw new Error(
      [
        `The current wallpaper is a DeskDoodle-generated image: ${capture.sourcePath}`,
        "DeskDoodle has no record of the original wallpaper, so it cannot start from here.",
        "Set your original wallpaper again, then run deskdoodle.",
      ].join("\n"),
    );
  }

  await renderBaseWallpaper(capture.sourcePath, paths.basePath, capture.monitor);

  const state: State = {
    version: 3,
    backend: selected.kind,
    restore: capture.restore,
    monitor: capture.monitor,
    baseSource: capture.sourcePath,
  };
  await writeJson(paths.statePath, state);

  return { state, wallpaper: selected };
};

/**
 * Rebuilds `base.png` when the monitor resolution changed since the session was created,
 * or when the file went missing. Reads geometry only, never the live wallpaper, which by
 * now is one of ours.
 */
const syncBaseImage = async (
  state: State,
  wallpaper: WallpaperProvider,
  paths: Paths,
): Promise<State> => {
  const monitor = await wallpaper.readMonitor();
  const sameSize =
    monitor.width === state.monitor.width && monitor.height === state.monitor.height;

  if (sameSize && (await pathExists(paths.basePath))) {
    return state;
  }

  if (!(await pathExists(state.baseSource))) {
    throw new Error(
      [
        `The original wallpaper is gone: ${state.baseSource}`,
        "DeskDoodle cannot rebuild its base image without it.",
        'Run "deskdoodle restore", then set a wallpaper and start again.',
      ].join("\n"),
    );
  }

  await renderBaseWallpaper(state.baseSource, paths.basePath, monitor);

  const next: State = { ...state, monitor };
  await writeJson(paths.statePath, next);
  return next;
};

/** The saved session, or `null` when there is none. Throws when the file is unreadable. */
export const readState = async (paths: Paths): Promise<State | null> => {
  const value = await readJson(paths.statePath);
  if (value === null) {
    return null;
  }

  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      [
        `Unreadable DeskDoodle session at ${paths.statePath}`,
        "Set your original wallpaper, delete that file, then run deskdoodle again.",
      ].join("\n"),
    );
  }

  const { version, backend, restore, monitor, baseSource } = parsed.data;
  return { version, backend, restore, monitor, baseSource };
};

export const readLayerScene = async (paths: Paths): Promise<SceneJson | null> => {
  const value = await readJson(paths.layerPath);
  if (value === null) {
    return null;
  }

  const parsed = sceneSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unreadable doodle scene at ${paths.layerPath}.`);
  }
  return parsed.data;
};

export const writeLayerScene = async (paths: Paths, scene: SceneJson): Promise<void> => {
  await writeJson(paths.layerPath, scene);
};

export const clearLayerFiles = async (paths: Paths): Promise<void> => {
  await Promise.all([
    removeIfExists(paths.layerPath),
    removeIfExists(paths.layerPngPath),
    removeIfExists(paths.renderedPath),
  ]);
};
