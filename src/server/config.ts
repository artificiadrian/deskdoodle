import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { readJson, writeJson } from "./files";
import { browserSelectionSchema } from "./providers/browser/index";
import { backendSelectionSchema } from "./providers/wallpaper/index";

/** Resolved on each call, like `getPaths`, so `$HOME` is never captured at import time. */
export const getConfigPath = (): string => join(homedir(), ".config", "deskdoodle", "config.json");

const configSchema = z.object({
  version: z.literal(1).default(1),
  backend: backendSelectionSchema.default("auto"),
  browser: browserSelectionSchema.default({ kind: "auto" }),
});

export type Config = z.infer<typeof configSchema>;

export const defaultConfig: Config = configSchema.parse({});

export const readConfig = async (): Promise<Config> => {
  const path = getConfigPath();
  const value = await readJson(path);
  if (value === null) {
    return defaultConfig;
  }

  const parsed = configSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid DeskDoodle config at ${path}:\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
};

export const writeConfig = async (config: Config): Promise<void> => {
  await writeJson(getConfigPath(), config);
};

const formatIssues = (error: z.ZodError): string => {
  return error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
};
