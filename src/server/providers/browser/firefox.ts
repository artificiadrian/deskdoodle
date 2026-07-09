import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { requireAllCommands } from "../../exec";
import type { BrowserProvider } from "./types";

export const firefoxBrowserProvider: BrowserProvider = {
  kind: "firefox-kiosk",
  command: "firefox",
  available: () => requireAllCommands(["firefox"]),
  launch: async (paths, url) => {
    const profileRoot = join(paths.runtimeDir, "firefox");
    await mkdir(profileRoot, { recursive: true });
    const profileDir = await mkdtemp(join(profileRoot, "profile-"));

    const process = spawn("firefox", ["--no-remote", "--profile", profileDir, "--kiosk", url], {
      stdio: "ignore",
    });
    process.once("exit", () => {
      void rm(profileDir, { recursive: true, force: true });
    });

    return { kind: "managed", process };
  },
};
