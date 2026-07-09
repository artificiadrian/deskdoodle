import type { PngDataUrl } from "./types";

export const pngDataUrlPrefix = "data:image/png;base64,";

export const parsePngDataUrl = (value: unknown): PngDataUrl => {
  if (typeof value !== "string" || !value.startsWith(pngDataUrlPrefix)) {
    throw new Error("Expected a PNG data URL.");
  }

  return value as PngDataUrl;
};
