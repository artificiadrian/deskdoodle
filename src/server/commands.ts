import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const readCommand = async (
  file: string,
  args: readonly string[],
): Promise<string> => {
  const { stdout } = await execFileAsync(file, [...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
};

export const runCommand = async (
  file: string,
  args: readonly string[],
): Promise<void> => {
  await execFileAsync(file, [...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
};

export const commandExists = async (file: string): Promise<boolean> => {
  const paths = (process.env.PATH ?? "").split(delimiter).filter(Boolean);

  for (const path of paths) {
    try {
      await access(join(path, file), constants.X_OK);
      return true;
    } catch {
      // Keep scanning PATH.
    }
  }

  return false;
};
