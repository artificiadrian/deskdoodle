import { writeFile } from "node:fs/promises";
import { pngDataUrlPrefix } from "../shared/data-url";
import type { MonitorGeometry, PngDataUrl } from "../shared/types";
import { runCommand } from "./commands";
import { ensureParentDir } from "./files";

export const renderBaseWallpaper = async (
  sourcePath: string,
  outputPath: string,
  monitor: MonitorGeometry,
): Promise<void> => {
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
};

export const writeLayerPngFromDataUrl = async (
  dataUrl: PngDataUrl,
  outputPath: string,
): Promise<void> => {
  await ensureParentDir(outputPath);
  await writeFile(outputPath, Buffer.from(dataUrl.slice(pngDataUrlPrefix.length), "base64"));
};

export const compositeWallpaper = async (
  basePath: string,
  layerPath: string,
  outputPath: string,
): Promise<void> => {
  await ensureParentDir(outputPath);
  await runCommand("magick", [
    basePath,
    layerPath,
    "-compose",
    "over",
    "-composite",
    outputPath,
  ]);
};
