import { fileURLToPath, pathToFileURL } from "node:url";
import type { MonitorGeometry } from "../shared/types.js";
import { readCommand, runCommand } from "./commands.js";

export type GnomeWallpaperSettings = {
  readonly pictureUri: string;
  readonly pictureUriDark: string;
  readonly pictureOptions: string;
};

export async function readGnomeWallpaperSettings(): Promise<GnomeWallpaperSettings> {
  const [pictureUri, pictureUriDark, pictureOptions] = await Promise.all([
    gsettingsGet("org.gnome.desktop.background", "picture-uri"),
    gsettingsGet("org.gnome.desktop.background", "picture-uri-dark"),
    gsettingsGet("org.gnome.desktop.background", "picture-options"),
  ]);

  return { pictureUri, pictureUriDark, pictureOptions };
}

export async function applyGnomeWallpaper(path: string): Promise<void> {
  const uri = pathToFileURL(path).href;
  await Promise.all([
    gsettingsSet("org.gnome.desktop.background", "picture-uri", uri),
    gsettingsSet("org.gnome.desktop.background", "picture-uri-dark", uri),
  ]);
}

export async function restoreGnomeWallpaper(
  pictureUri: string,
  pictureUriDark: string,
): Promise<void> {
  await Promise.all([
    gsettingsSet("org.gnome.desktop.background", "picture-uri", pictureUri),
    gsettingsSet("org.gnome.desktop.background", "picture-uri-dark", pictureUriDark),
  ]);
}

export function wallpaperUriToPath(uri: string): string {
  if (!uri.startsWith("file://")) {
    throw new Error(`Only local file wallpapers are supported for v1: ${uri}`);
  }
  return fileURLToPath(uri);
}

export async function getPrimaryMonitorGeometry(): Promise<MonitorGeometry> {
  const output = await readCommand("gdbus", [
    "call",
    "--session",
    "--dest",
    "org.gnome.Mutter.DisplayConfig",
    "--object-path",
    "/org/gnome/Mutter/DisplayConfig",
    "--method",
    "org.gnome.Mutter.DisplayConfig.GetCurrentState",
  ]);

  return parseMutterDisplayState(output);
}

export function parseMutterDisplayState(output: string): MonitorGeometry {
  const currentMode = output.match(
    /'(\d+)x(\d+)@[0-9.]+',\s*(\d+),\s*(\d+),[^{}]*\{[^}]*'is-current':\s*<true>/s,
  );
  if (!currentMode) {
    throw new Error("Could not find the current GNOME monitor mode.");
  }

  const connector = output.match(/\(\('([^']+)',\s*'[^']*',\s*'([^']*)',\s*'[^']*'\)/);
  const displayName = output.match(/'display-name':\s*<'([^']+)'>/);
  const logical = output.match(
    /\[\((-?\d+),\s*(-?\d+),\s*([0-9.]+),\s*uint32\s+\d+,\s*(true|false),\s*\[/,
  );

  const id = connector?.[1] ?? "unknown";
  const model = connector?.[2] ?? id;
  const name = displayName?.[1] ?? model;
  const width = Number.parseInt(currentMode[3] ?? currentMode[1] ?? "", 10);
  const height = Number.parseInt(currentMode[4] ?? currentMode[2] ?? "", 10);
  const scale = logical?.[3] ? Number.parseFloat(logical[3]) : 1;
  const primary = logical?.[4] === "true";

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid GNOME monitor dimensions: ${width}x${height}`);
  }

  return { id, name, width, height, scale, primary };
}

async function gsettingsGet(schema: string, key: string): Promise<string> {
  const output = await readCommand("gsettings", ["get", schema, key]);
  return parseGSettingsString(output);
}

async function gsettingsSet(schema: string, key: string, value: string): Promise<void> {
  await runCommand("gsettings", ["set", schema, key, value]);
}

function parseGSettingsString(output: string): string {
  const trimmed = output.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("\\'", "'");
  }
  return trimmed;
}
