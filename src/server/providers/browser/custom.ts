import { spawn } from "node:child_process";
import { requireAllCommands } from "../../exec";
import type { BrowserProvider } from "./types";

export const customBrowserProvider = (
  command: string,
  args: readonly string[],
): BrowserProvider => ({
  kind: "custom",
  command,
  available: () => requireAllCommands([command]),
  launch: async (_paths, url) => {
    const process = spawn(command, withUrl(args, url), { stdio: "ignore" });
    return { kind: "managed", process };
  },
});

/** Substitutes `{url}` wherever it appears, or appends the URL when it does not. */
const withUrl = (args: readonly string[], url: string): string[] => {
  if (args.some((arg) => arg.includes("{url}"))) {
    return args.map((arg) => arg.replaceAll("{url}", url));
  }
  return [...args, url];
};
