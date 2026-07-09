import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

declare const pngDataUrlBrand: unique symbol;

export type PngDataUrl = string & {
  readonly [pngDataUrlBrand]: "PngDataUrl";
};

export const backendSelectionKinds = ["auto", "gnome"] as const;

export type BackendSelectionKind = (typeof backendSelectionKinds)[number];

export type BackendSelection = { readonly kind: BackendSelectionKind };

export const browserSelectionKinds = [
  "auto",
  "firefox-kiosk",
  "chromium-app",
  "xdg-open",
  "custom",
] as const;

export type BrowserSelectionKind = (typeof browserSelectionKinds)[number];

export type BrowserSelection =
  | { readonly kind: "auto" }
  | { readonly kind: "firefox-kiosk" }
  | { readonly kind: "chromium-app" }
  | { readonly kind: "xdg-open" }
  | {
      readonly kind: "custom";
      readonly command: string;
      readonly args: readonly string[];
    };

export type DeskDoodleConfig = {
  readonly version: 1;
  readonly backend: BackendSelection;
  readonly browser: BrowserSelection;
};

export type ResolvedWallpaperBackend = { readonly kind: "gnome" };

export type RestoreTarget = {
  readonly kind: "gnome";
  readonly pictureUri: string;
  readonly pictureUriDark: string;
};

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
  readonly version: 2;
  readonly backend: ResolvedWallpaperBackend;
  readonly restoreTarget: RestoreTarget;
  readonly baseSourceUri: string;
  readonly pictureOptions: string;
  readonly monitor: MonitorGeometry;
  readonly paths: DeskDoodlePaths;
  readonly updatedAt: string;
};

export type ExcalidrawSceneFile = ImportedDataState;

export type EditorWorkspace = {
  readonly baseImageUrl: string;
  readonly monitor: MonitorGeometry;
  readonly scene: ExcalidrawSceneFile | null;
};

export type ApplyWorkspaceRequest = {
  readonly scene: ExcalidrawSceneFile;
  readonly layerPngDataUrl: PngDataUrl;
};

export type ApplyWorkspaceResponse = {
  readonly ok: true;
  readonly renderedPath: string;
};

export type ErrorResponse = {
  readonly ok: false;
  readonly error: string;
};
