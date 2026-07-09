import { requireAllCommands, runCommand } from "../../exec";
import type { BrowserProvider } from "./types";

export const xdgOpenBrowserProvider: BrowserProvider = {
  kind: "xdg-open",
  command: "xdg-open",
  available: () => requireAllCommands(["xdg-open"]),
  launch: async (_paths, url) => {
    await runCommand("xdg-open", [url]);
    return { kind: "unmanaged" };
  },
};
