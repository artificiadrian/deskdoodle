import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function readCommand(
  file: string,
  args: readonly string[],
): Promise<string> {
  const { stdout } = await execFileAsync(file, [...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export async function runCommand(
  file: string,
  args: readonly string[],
): Promise<void> {
  await execFileAsync(file, [...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}
