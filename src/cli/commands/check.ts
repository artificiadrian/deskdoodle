import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import pc from "picocolors";
import { commandExists } from "../../server/commands";
import { getConfigPath, readConfig } from "../../server/config";
import { getPaths } from "../../server/paths";
import { resolveBrowserProvider } from "../../server/providers/browser/index";
import { resolveWallpaperProvider } from "../../server/providers/wallpaper/index";
import type { WallpaperProvider } from "../../server/providers/wallpaper/types";
import type { DeskDoodleConfig } from "../../shared/types";
import { handleError, logError, logInfo, logSuccess } from "../ui";

type CheckRow = {
  readonly label: string;
  readonly value: string;
};

type ProviderCheck = {
  readonly ok: boolean;
  readonly value: string;
};

type WallpaperCheck = ProviderCheck & {
  readonly monitor: string;
  readonly wallpaper: string;
};

export type CheckCommandResult = {
  readonly ok: boolean;
  readonly output: string;
};

export const registerCheckCommand = (program: Command): void => {
  program
    .command("check")
    .usage("")
    .description("check providers and required tools")
    .action(() => {
      void checkSetup().catch(handleError);
    });
};

export const runCheckCommand = async (): Promise<CheckCommandResult> => {
  const rows: CheckRow[] = [];
  const config = await readConfig();
  const paths = getPaths();

  rows.push(
    { label: "config", value: getConfigPath() },
    { label: "shared folder", value: paths.dataDir },
  );

  const imageMagick = await commandExists("magick");
  rows.push({ label: "ImageMagick", value: statusValue(imageMagick) });

  const browser = await checkBrowserProvider(config);
  rows.push({ label: "browser launcher", value: browser.value });

  const wallpaper = await checkWallpaperProvider(config);
  rows.push({ label: "wallpaper provider", value: wallpaper.value });
  rows.push({ label: "monitor", value: wallpaper.monitor });
  rows.push({ label: "wallpaper", value: wallpaper.wallpaper });

  const ok = imageMagick && browser.ok && wallpaper.ok;
  return {
    ok,
    output: formatCheckRows(rows),
  };
};

const checkBrowserProvider = async (config: DeskDoodleConfig): Promise<ProviderCheck> => {
  try {
    const browser = await resolveBrowserProvider(config.browser);
    return { ok: true, value: providerValue(browser.kind) };
  } catch {
    return { ok: false, value: missingValue("missing") };
  }
};

const checkWallpaperProvider = async (config: DeskDoodleConfig): Promise<WallpaperCheck> => {
  let wallpaper: WallpaperProvider;

  try {
    wallpaper = await resolveWallpaperProvider(config.backend);
  } catch {
    return {
      ok: false,
      value: missingValue("missing"),
      monitor: missingValue("skipped"),
      wallpaper: missingValue("skipped"),
    };
  }

  try {
    const capture = await wallpaper.capture();
    return {
      ok: true,
      value: providerValue(wallpaper.kind),
      monitor: `${capture.monitor.width}x${capture.monitor.height} ${capture.monitor.name}`,
      wallpaper: displayWallpaper(capture.baseSourceUri),
    };
  } catch {
    return {
      ok: false,
      value: providerValue(wallpaper.kind),
      monitor: missingValue("skipped"),
      wallpaper: missingValue("missing"),
    };
  }
};

const formatCheckRows = (rows: readonly CheckRow[]): string => {
  const labelWidth = rows.reduce((width, row) => Math.max(width, row.label.length), 0);
  return rows
    .map((row) => {
      return `  ${pc.white(row.label.padEnd(labelWidth))}  ${row.value}`;
    })
    .join("\n");
};

const statusValue = (ok: boolean): string => {
  return ok ? pc.bold("available") : missingValue("missing");
};

const providerValue = (value: string): string => {
  return pc.bold(value);
};

const missingValue = (value: string): string => {
  return pc.bold(pc.red(value));
};

const displayWallpaper = (source: string): string => {
  if (!source.startsWith("file://")) {
    return source;
  }

  try {
    return fileURLToPath(source);
  } catch {
    return source;
  }
};

const checkSetup = async (): Promise<void> => {
  const result = await runCheckCommand();
  logInfo("check");
  console.log(result.output);

  if (result.ok) {
    logSuccess(pc.bold("everything is ready"));
    return;
  }

  logError(pc.bold("setup needs attention"));
  process.exitCode = 1;
};
