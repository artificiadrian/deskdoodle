import { spawn } from "node:child_process";
import { commandExists } from "../../commands";
import type { BrowserProvider } from "./types";

export const customBrowserProvider = (
  command: string,
  args: readonly string[],
): BrowserProvider => {
  return {
    kind: "custom",
    command,
    available: async () => commandExists(command),
    launch: async (_paths, url) => {
      const process = spawn(command, withUrl(args, url), { stdio: "ignore" });
      return { kind: "managed", process };
    },
  };
};

const withUrl = (args: readonly string[], url: string): readonly string[] => {
  if (args.some((arg) => arg.includes("{url}"))) {
    return args.map((arg) => arg.replaceAll("{url}", url));
  }
  return [...args, url];
};
