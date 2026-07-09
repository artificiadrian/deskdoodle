export type WallpaperBackend = "gnome";

export type MonitorGeometry = {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly primary: boolean;
};

export type DeskDoodlePaths = {
  readonly dataDir: string;
  readonly basePath: string;
  readonly layerPath: string;
  readonly layerPngPath: string;
  readonly renderedPath: string;
  readonly statePath: string;
  readonly runtimeDir: string;
};

export type DeskDoodleState = {
  readonly version: 1;
  readonly backend: WallpaperBackend;
  readonly originalPictureUri: string;
  readonly originalPictureUriDark: string;
  readonly baseSourceUri: string;
  readonly pictureOptions: string;
  readonly monitor: MonitorGeometry;
  readonly paths: DeskDoodlePaths;
  readonly updatedAt: string;
};

export type ExcalidrawSceneFile = ImportedDataState;

export type EditorBootstrap = {
  readonly token: string;
  readonly baseUrl: string;
  readonly monitor: MonitorGeometry;
  readonly scene: ExcalidrawSceneFile | null;
};

export type SaveRequest = {
  readonly scene: ExcalidrawSceneFile;
  readonly layerPngDataUrl: string;
};

export type SaveResponse = {
  readonly ok: true;
  readonly renderedPath: string;
};

export type ErrorResponse = {
  readonly ok: false;
  readonly error: string;
};
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
