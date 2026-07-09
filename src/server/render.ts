import { writeFile } from "node:fs/promises";
import type { Monitor } from "../shared/protocol";
import { runCommand } from "./exec";
import { ensureParentDir } from "./files";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Scales the source wallpaper to exactly fill the monitor, cropping the overflow. */
export const renderBaseWallpaper = async (
  sourcePath: string,
  outputPath: string,
  monitor: Monitor,
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

/**
 * Decodes base64 layer bytes and writes them out.
 * Rejects anything that is not a PNG, so ImageMagick never sees junk.
 */
export const writeLayerPng = async (base64: string, outputPath: string): Promise<void> => {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error("Expected the doodle layer to be PNG bytes.");
  }

  await ensureParentDir(outputPath);
  await writeFile(outputPath, bytes);
};

export const compositeWallpaper = async (
  basePath: string,
  layerPath: string,
  outputPath: string,
): Promise<void> => {
  await ensureParentDir(outputPath);
  await runCommand("magick", [basePath, layerPath, "-compose", "over", "-composite", outputPath]);
};
