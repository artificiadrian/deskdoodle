import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureParentDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureParentDir(path);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function removeIfExists(path: string): Promise<void> {
  try {
    await rm(path);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
