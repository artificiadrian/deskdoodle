import { z } from "zod";
import type { Monitor } from "../../../shared/protocol";
import type { Availability } from "../../result";

/** Every wallpaper backend. Adding one here drives the config, state, and check surfaces. */
export const wallpaperKinds = ["gnome"] as const;

export type WallpaperKind = (typeof wallpaperKinds)[number];

export const backendSelectionKinds = ["auto", ...wallpaperKinds] as const;

export const backendSelectionSchema = z.enum(backendSelectionKinds);

/** Which backend the user picked; `auto` probes for the first available one. */
export type BackendSelection = z.infer<typeof backendSelectionSchema>;

export type Capture = {
  readonly monitor: Monitor;
  /** The wallpaper the base image is built from. Never inside our data directory. */
  readonly sourcePath: string;
  readonly sourceUri: string;
  /** Opaque to everyone but the provider that produced it; persisted verbatim. */
  readonly restore: unknown;
};

export type WallpaperProvider = {
  readonly kind: WallpaperKind;
  readonly available: () => Promise<Availability>;
  /** Geometry only. Safe to call on every run, unlike `capture`. */
  readonly readMonitor: () => Promise<Monitor>;
  /** Reads the desktop's *current* wallpaper. Only valid before we have applied our own. */
  readonly capture: () => Promise<Capture>;
  readonly apply: (path: string) => Promise<void>;
  /** Parses its own restore blob back out of `state.json`. */
  readonly restore: (raw: unknown) => Promise<void>;
};
