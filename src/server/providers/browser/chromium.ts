import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { commandExists } from "../../commands";
import type { BrowserProvider } from "./types";

const commands = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"] as const;

export const chromiumBrowserProvider = async (): Promise<BrowserProvider> => {
  const command = await resolveChromiumCommand();
  return {
    kind: "chromium-app",
    command,
    available: async () => commandExists(command),
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

const resolveChromiumCommand = async (): Promise<string> => {
  for (const command of commands) {
    if (await commandExists(command)) {
      return command;
    }
  }
  return commands[0];
};
