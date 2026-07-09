import { mkdir } from "node:fs/promises";
import type { DeskDoodleState, ExcalidrawSceneFile } from "../shared/types.js";
import { readJson, removeIfExists, writeJson } from "./files.js";
import {
  getPrimaryMonitorGeometry,
  readGnomeWallpaperSettings,
  wallpaperUriToPath,
} from "./gnome.js";
import { getPaths } from "./paths.js";
import { renderBaseWallpaper } from "./render.js";

export async function prepareState(): Promise<DeskDoodleState> {
  const paths = getPaths();
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(paths.runtimeDir, { recursive: true });

  const existing = await readJson<DeskDoodleState>(paths.statePath);
  if (existing) {
    return existing;
  }

  const settings = await readGnomeWallpaperSettings();
  const monitor = await getPrimaryMonitorGeometry();
  const sourcePath = wallpaperUriToPath(settings.pictureUri);

  await renderBaseWallpaper(sourcePath, paths.basePath, monitor);

  const state: DeskDoodleState = {
    version: 1,
    backend: "gnome",
    originalPictureUri: settings.pictureUri,
    originalPictureUriDark: settings.pictureUriDark,
    baseSourceUri: settings.pictureUri,
    pictureOptions: settings.pictureOptions,
    monitor,
    paths,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(paths.statePath, state);
  return state;
}

export async function readLayerScene(
  state: DeskDoodleState,
): Promise<ExcalidrawSceneFile | null> {
  return readJson<ExcalidrawSceneFile>(state.paths.layerPath);
}

export async function writeLayerScene(
  state: DeskDoodleState,
  scene: ExcalidrawSceneFile,
): Promise<void> {
  await writeJson(state.paths.layerPath, {
    ...scene,
    type: "excalidraw",
    source: "deskdoodle",
  });
}

export async function clearLayerFiles(state: DeskDoodleState): Promise<void> {
  await Promise.all([
    removeIfExists(state.paths.layerPath),
    removeIfExists(state.paths.layerPngPath),
    removeIfExists(state.paths.renderedPath),
  ]);
}
