import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join, sep } from "node:path";
import { promisify } from "node:util";
import type { Availability, Success, Unavailable } from "./result";

const execFileAsync = promisify(execFile);

const execOptions = { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 } as const;

export const readCommand = async (file: string, args: readonly string[]): Promise<string> => {
  const { stdout } = await execFileAsync(file, [...args], execOptions);
  return stdout;
};

export const runCommand = async (file: string, args: readonly string[]): Promise<void> => {
  await execFileAsync(file, [...args], execOptions);
};

export const commandExists = async (file: string): Promise<boolean> => {
  // Mirrors how execFile/spawn resolve a command: one containing a separator is
  // a path, and is never looked up on PATH.
  if (file.includes(sep)) {
    return isExecutable(file);
  }

  const paths = (process.env.PATH ?? "").split(delimiter).filter(Boolean);

  for (const path of paths) {
    if (await isExecutable(join(path, file))) {
      return true;
    }
  }

  return false;
};

const isExecutable = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** Available only when every command exists. Reports the ones that do not. */
export const requireAllCommands = async (
  commands: readonly string[],
): Promise<Availability> => {
  const found = await Promise.all(commands.map((command) => commandExists(command)));
  const missing = commands.filter((_, index) => !found[index]);

  if (missing.length === 0) {
    return { success: true };
  }
  return { success: false, error: "unavailable", needs: { kind: "all", commands: missing } };
};

/** The first candidate that exists. Probes each name exactly once. */
export const requireAnyCommand = async (
  candidates: readonly string[],
): Promise<FoundCommand | Unavailable> => {
  for (const command of candidates) {
    if (await commandExists(command)) {
      return { success: true, command };
    }
  }
  return { success: false, error: "unavailable", needs: { kind: "any", commands: candidates } };
};

/** A command that was found on PATH. */
export type FoundCommand = Success & { readonly command: string };
