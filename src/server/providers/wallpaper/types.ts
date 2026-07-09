import type {
  DeskDoodleState,
  MonitorGeometry,
  ResolvedWallpaperBackend,
  RestoreTarget,
} from "../../../shared/types";

export type WallpaperCapture = {
  readonly backend: ResolvedWallpaperBackend;
  readonly restoreTarget: RestoreTarget;
  readonly baseSourceUri: string;
  readonly baseSourcePath: string;
  readonly pictureOptions: string;
  readonly monitor: MonitorGeometry;
};

export type WallpaperProvider = {
  readonly kind: ResolvedWallpaperBackend["kind"];
  readonly available: () => Promise<boolean>;
  readonly capture: () => Promise<WallpaperCapture>;
  readonly apply: (path: string) => Promise<void>;
  readonly restore: (state: DeskDoodleState) => Promise<void>;
};
