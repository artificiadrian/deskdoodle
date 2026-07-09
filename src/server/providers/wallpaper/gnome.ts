import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import type { Monitor } from "../../../shared/protocol";
import { readCommand, requireAllCommands, runCommand } from "../../exec";
import type { Capture, WallpaperProvider } from "./types";

const backgroundSchema = "org.gnome.desktop.background";

/** GNOME's restore blob: the wallpaper URIs as they were before we touched them. */
const gnomeRestoreSchema = z.object({
  pictureUri: z.string(),
  pictureUriDark: z.string(),
});

const readMonitor = async (): Promise<Monitor> => {
  return parseMutterDisplayState(
    await readCommand("gdbus", [
      "call",
      "--session",
      "--dest",
      "org.gnome.Mutter.DisplayConfig",
      "--object-path",
      "/org/gnome/Mutter/DisplayConfig",
      "--method",
      "org.gnome.Mutter.DisplayConfig.GetCurrentState",
    ]),
  );
};

export const gnomeWallpaperProvider: WallpaperProvider = {
  kind: "gnome",

  available: () => requireAllCommands(["gsettings", "gdbus"]),

  readMonitor,

  capture: async (): Promise<Capture> => {
    const [pictureUri, pictureUriDark, monitor] = await Promise.all([
      gsettingsGet("picture-uri"),
      gsettingsGet("picture-uri-dark"),
      readMonitor(),
    ]);

    return {
      monitor,
      sourcePath: wallpaperUriToPath(pictureUri),
      sourceUri: pictureUri,
      restore: { pictureUri, pictureUriDark },
    };
  },

  apply: async (path: string): Promise<void> => {
    const uri = pathToFileURL(path).href;
    await setWallpaperUris(uri, uri);
  },

  restore: async (raw: unknown): Promise<void> => {
    const target = gnomeRestoreSchema.parse(raw);
    await setWallpaperUris(target.pictureUri, target.pictureUriDark);
  },
};

const setWallpaperUris = async (pictureUri: string, pictureUriDark: string): Promise<void> => {
  await Promise.all([
    gsettingsSet("picture-uri", pictureUri),
    gsettingsSet("picture-uri-dark", pictureUriDark),
  ]);
};

const wallpaperUriToPath = (uri: string): string => {
  if (!uri.startsWith("file://")) {
    throw new Error(`DeskDoodle only supports local wallpaper files, not: ${uri}`);
  }
  return fileURLToPath(uri);
};

/** Pulls the current mode's pixel size and a display name out of Mutter's GetCurrentState. */
const parseMutterDisplayState = (output: string): Monitor => {
  const currentMode = output.match(
    /'(\d+)x(\d+)@[0-9.]+',\s*(\d+),\s*(\d+),[^{}]*\{[^}]*'is-current':\s*<true>/s,
  );
  if (!currentMode) {
    throw new Error("Could not find the current GNOME monitor mode.");
  }

  const connector = output.match(/\(\('([^']+)',\s*'[^']*',\s*'([^']*)',\s*'[^']*'\)/);
  const displayName = output.match(/'display-name':\s*<'([^']+)'>/);

  const id = connector?.[1] ?? "unknown";
  const name = displayName?.[1] ?? connector?.[2] ?? id;
  const width = Number.parseInt(currentMode[3] ?? currentMode[1] ?? "", 10);
  const height = Number.parseInt(currentMode[4] ?? currentMode[2] ?? "", 10);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid GNOME monitor dimensions: ${width}x${height}`);
  }

  return { name, width, height };
};

const gsettingsGet = async (key: string): Promise<string> => {
  return parseGSettingsString(await readCommand("gsettings", ["get", backgroundSchema, key]));
};

const gsettingsSet = async (key: string, value: string): Promise<void> => {
  await runCommand("gsettings", ["set", backgroundSchema, key, value]);
};

const parseGSettingsString = (output: string): string => {
  const trimmed = output.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("\\'", "'");
  }
  return trimmed;
};
