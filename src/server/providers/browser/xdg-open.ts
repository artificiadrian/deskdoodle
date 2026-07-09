import { commandExists, runCommand } from "../../commands";
import type { BrowserProvider } from "./types";

export const xdgOpenBrowserProvider: BrowserProvider = {
  kind: "xdg-open",
  command: "xdg-open",
  available: async () => commandExists("xdg-open"),
  launch: async (_paths, url) => {
    await runCommand("xdg-open", [url]);
    return { kind: "unmanaged" };
  },
};
