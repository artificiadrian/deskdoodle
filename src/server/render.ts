import { writeFile } from "node:fs/promises";
import type { MonitorGeometry } from "../shared/types.js";
import { runCommand } from "./commands.js";
import { ensureParentDir } from "./files.js";

export async function renderBaseWallpaper(
  sourcePath: string,
  outputPath: string,
  monitor: MonitorGeometry,
): Promise<void> {
  await ensureParentDir(outputPath);
  await runCommand("magick", [
    sourcePath,
    "-auto-orient",
    "-resize",
    `${monitor.width}x${monitor.height}^`,
    "-gravity",
    "center",
    "-extent",
    `${monitor.width}x${monitor.height}`,
    outputPath,
  ]);
}

export async function writeLayerPngFromDataUrl(
  dataUrl: string,
  outputPath: string,
): Promise<void> {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match?.[1]) {
    throw new Error("Editor did not send a PNG data URL.");
  }
  await ensureParentDir(outputPath);
  await writeFile(outputPath, Buffer.from(match[1], "base64"));
}

export async function compositeWallpaper(
  basePath: string,
  layerPath: string,
  outputPath: string,
): Promise<void> {
  await ensureParentDir(outputPath);
  await runCommand("magick", [
    basePath,
    layerPath,
    "-compose",
    "over",
    "-composite",
    outputPath,
  ]);
}
