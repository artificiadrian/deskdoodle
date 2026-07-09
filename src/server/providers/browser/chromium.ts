import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { requireAnyCommand } from "../../exec";
import type { BrowserProvider } from "./types";

const chromiumCommands = [
  "chromium",
  "chromium-browser",
  "google-chrome",
  "google-chrome-stable",
] as const;

/** Probes the candidate names once, then reports availability from that result. */
export const chromiumBrowserProvider = async (): Promise<BrowserProvider> => {
  const found = await requireAnyCommand(chromiumCommands);

  if (!found.success) {
    return {
      kind: "chromium-app",
      command: chromiumCommands.join(", "),
      available: async () => found,
      launch: async () => {
        throw new Error("No Chromium-based browser is installed.");
      },
    };
  }

  const { command } = found;
  return {
    kind: "chromium-app",
    command,
    available: async () => ({ success: true }),
    launch: async (paths, url) => {
      await mkdir(paths.runtimeDir, { recursive: true });
      const process = spawn(
        command,
        [
          `--user-data-dir=${join(paths.runtimeDir, "chromium")}`,
          "--start-fullscreen",
          `--app=${url}`,
        ],
        { stdio: "ignore" },
      );
      return { kind: "managed", process };
    },
  };
};
