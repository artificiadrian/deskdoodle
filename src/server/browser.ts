import { mkdir } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import type { DeskDoodleState } from "../shared/types.js";
import { runCommand } from "./commands.js";

export async function openEditorBrowser(
  state: DeskDoodleState,
  url: string,
): Promise<ChildProcess | null> {
  try {
    await mkdir(state.paths.runtimeDir, { recursive: true });
    const child = spawn(
      "firefox",
      ["--no-remote", "--profile", state.paths.runtimeDir, "--kiosk", url],
      {
        stdio: "ignore",
      },
    );
    child.unref();
    return child;
  } catch {
    await runCommand("xdg-open", [url]);
    return null;
  }
}
