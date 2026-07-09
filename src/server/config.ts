import { homedir } from "node:os";
import { join } from "node:path";
import type {
  BackendSelection,
  BrowserSelection,
  DeskDoodleConfig,
} from "../shared/types";
import { backendSelectionKinds, browserSelectionKinds } from "../shared/types";
import { readJson, writeJson } from "./files";

const configPath = join(homedir(), ".config", "deskdoodle", "config.json");

export const defaultConfig: DeskDoodleConfig = {
  version: 1,
  backend: { kind: "auto" },
  browser: { kind: "auto" },
};

export const readConfig = async (): Promise<DeskDoodleConfig> => {
  const value = await readJson<unknown>(configPath);
  if (value === null) {
    return defaultConfig;
  }
  return parseConfig(value);
};

export const writeConfig = async (config: DeskDoodleConfig): Promise<void> => {
  await writeJson(configPath, config);
};

export const getConfigPath = (): string => {
  return configPath;
};

export const setConfigBackend = (
  config: DeskDoodleConfig,
  backend: BackendSelection,
): DeskDoodleConfig => {
  return { ...config, backend };
};

export const setConfigBrowser = (
  config: DeskDoodleConfig,
  browser: BrowserSelection,
): DeskDoodleConfig => {
  return { ...config, browser };
};

export const parseBackendSelectionName = (value: string): BackendSelection => {
  if (isOneOf(value, backendSelectionKinds)) {
    return { kind: value };
  }
  throw new Error(`Expected backend to be one of: ${backendSelectionKinds.join(", ")}.`);
};

export const parseBrowserSelectionName = (
  value: string,
  command: string | undefined,
  args: readonly string[],
): BrowserSelection => {
  if (!isOneOf(value, browserSelectionKinds)) {
    throw new Error(`Expected browser to be one of: ${browserSelectionKinds.join(", ")}.`);
  }
  if (value === "custom") {
    if (!command) {
      throw new Error("Custom browser requires a command.");
    }
    return { kind: "custom", command, args };
  }
  return { kind: value };
};

const parseConfig = (value: unknown): DeskDoodleConfig => {
  if (!isRecord(value)) {
    throw new Error(`Invalid DeskDoodle config at ${configPath}: expected object.`);
  }

  const version = value.version ?? defaultConfig.version;
  if (version !== 1) {
    throw new Error(`Invalid DeskDoodle config at ${configPath}: unsupported version ${String(version)}.`);
  }

  return {
    version: 1,
    backend: parseBackendSelection(value.backend),
    browser: parseBrowserSelection(value.browser),
  };
};

const parseBackendSelection = (value: unknown): BackendSelection => {
  if (value === undefined) {
    return defaultConfig.backend;
  }
  if (!isRecord(value)) {
    throw new Error("Invalid backend config: expected object.");
  }

  switch (value.kind) {
    case "auto":
    case "gnome":
      return parseBackendSelectionName(value.kind);
    default:
      throw new Error(`Invalid backend config: unsupported backend ${String(value.kind)}.`);
  }
};

const parseBrowserSelection = (value: unknown): BrowserSelection => {
  if (value === undefined) {
    return defaultConfig.browser;
  }
  if (!isRecord(value)) {
    throw new Error("Invalid browser config: expected object.");
  }

  switch (value.kind) {
    case "auto":
    case "firefox-kiosk":
    case "chromium-app":
    case "xdg-open":
      return parseBrowserSelectionName(value.kind, undefined, []);
    case "custom":
      return parseCustomBrowser(value);
    default:
      throw new Error(`Invalid browser config: unsupported browser ${String(value.kind)}.`);
  }
};

const parseCustomBrowser = (value: Record<string, unknown>): BrowserSelection => {
  if (typeof value.command !== "string" || value.command.length === 0) {
    throw new Error("Invalid browser config: custom browser requires command.");
  }
  if (!Array.isArray(value.args) || !value.args.every((arg) => typeof arg === "string")) {
    throw new Error("Invalid browser config: custom browser args must be strings.");
  }

  return {
    kind: "custom",
    command: value.command,
    args: value.args,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isOneOf = <T extends readonly string[]>(value: string, options: T): value is T[number] => {
  return options.some((option) => option === value);
};
