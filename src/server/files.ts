import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const ensureParentDir = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

export const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const writeJson = async (path: string, value: unknown): Promise<void> => {
  await ensureParentDir(path);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const removeIfExists = async (path: string): Promise<void> => {
  try {
    await rm(path);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
};

export const isNodeError = (error: unknown): error is NodeJS.ErrnoException => {
  return error instanceof Error && "code" in error;
};
