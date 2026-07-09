import {
  openEditorBrowser,
  resolveBrowserProvider,
  type BrowserLaunch,
} from "../../server/providers/browser/index";
import type { Command } from "commander";
import pc from "picocolors";
import {
  startEditorServer,
  type EditorSessionResult,
  type FinishedEditorSessionResult,
} from "../../server/editor-server";
import { clearLayerFiles, prepareState } from "../../server/state";
import { commandExists } from "../../server/commands";
import { readConfig } from "../../server/config";
import { resolveWallpaperProvider } from "../../server/providers/wallpaper/index";
import type { WallpaperProvider } from "../../server/providers/wallpaper/types";
import { handleError, link, logError, logInfo, logSuccess, logWarning } from "../ui";

type WallpaperProviderKind = WallpaperProvider["kind"];

export type DeskDoodleAction =
  | { readonly kind: "open" }
  | { readonly kind: "clear" }
  | { readonly kind: "reset" };

export type DeskDoodleCommandResult =
  | { readonly kind: "cleared" }
  | { readonly kind: "reset"; readonly wallpaperProvider: WallpaperProviderKind }
  | { readonly kind: "saved"; readonly renderedPath: string; readonly wallpaperProvider: WallpaperProviderKind }
  | { readonly kind: "canceled" }
  | { readonly kind: "closed" }
  | { readonly kind: "failed"; readonly message: string };

export type EditorCommandEvents = {
  readonly opened: (url: string, browserKind: string) => void;
};

type RequiredCommand = {
  readonly command: string;
  readonly installHint: string;
  readonly reason: string;
};

const requiredCommands = [
  {
    command: "magick",
    installHint: "ImageMagick",
    reason: "render and composite wallpaper PNGs",
  },
] as const satisfies readonly RequiredCommand[];

export const registerEditorCommands = (program: Command): void => {
  program.action(() => {
    void runEditorAction({ kind: "open" }).catch(handleError);
  });

  program
    .command("clear")
    .usage("")
    .description("remove saved doodles")
    .action(() => {
      void runEditorAction({ kind: "clear" }).catch(handleError);
    });

  program
    .command("reset")
    .usage("")
    .description("restore the original wallpaper")
    .action(() => {
      void runEditorAction({ kind: "reset" }).catch(handleError);
    });
};

export const runDeskDoodleCommand = async (
  action: DeskDoodleAction,
  events: EditorCommandEvents,
): Promise<DeskDoodleCommandResult> => {
  const config = await readConfig();
  await checkRuntimeDependencies();
  const selectedWallpaper = await resolveWallpaperProvider(config.backend);

  const prepared = await prepareState(selectedWallpaper);
  const { state, wallpaper } = prepared;

  if (action.kind === "clear") {
    await clearLayerFiles(state);
    await wallpaper.apply(state.paths.basePath);
    return { kind: "cleared" };
  }

  if (action.kind === "reset") {
    await wallpaper.restore(state);
    return { kind: "reset", wallpaperProvider: wallpaper.kind };
  }

  const browser = await resolveBrowserProvider(config.browser);
  let browserLaunch: BrowserLaunch | null = null;
  let shuttingDown = false;
  let resolveDone: (result: FinishedEditorSessionResult) => void;

  const done = new Promise<FinishedEditorSessionResult>((resolve) => {
    resolveDone = resolve;
  });

  const server = await startEditorServer(state, wallpaper, () => void shutdown());

  const shutdown = async (fallbackResult?: FinishedEditorSessionResult): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    if (fallbackResult && server.result().kind === "open") {
      server.closeAs(fallbackResult);
    }
    if (browserLaunch?.kind === "managed") {
      browserLaunch.process.kill("SIGTERM");
    }
    await server.close();
    resolveDone(finalResult(server.result()));
  };

  browserLaunch = await openEditorBrowser(browser, state.paths, server.url);
  if (browserLaunch.kind === "managed") {
    browserLaunch.process.once("exit", () => {
      setTimeout(() => void shutdown({ kind: "closed" }), 200);
    });
    browserLaunch.process.once("error", () => void shutdown({ kind: "closed" }));
  }
  process.once("SIGINT", () => void shutdown({ kind: "canceled" }));
  process.once("SIGTERM", () => void shutdown({ kind: "canceled" }));
  events.opened(server.url, browser.kind);

  return withWallpaperProvider(await done, wallpaper.kind);
};

const runEditorAction = async (action: DeskDoodleAction): Promise<void> => {
  const result = await runDeskDoodleCommand(action, {
    opened: (url, browserKind) => {
      logInfo(`opened editor ${link(url)} with ${pc.bold(browserKind)}`);
    },
  });
  reportCommandResult(result);
};

const checkRuntimeDependencies = async (): Promise<void> => {
  const missingRequired = (
    await Promise.all(
      requiredCommands.map(async (requirement) => ({
        requirement,
        exists: await commandExists(requirement.command),
      })),
    )
  )
    .filter((result) => !result.exists)
    .map((result) => result.requirement);

  if (missingRequired.length === 0) {
    return;
  }

  const lines = ["missing runtime dependencies:"];

  for (const missing of missingRequired) {
    lines.push(`  ${missing.command} (${missing.installHint}) - needed to ${missing.reason}`);
  }

  throw new Error(lines.join("\n"));
};

const finalResult = (result: EditorSessionResult): FinishedEditorSessionResult => {
  if (result.kind === "open") {
    return { kind: "closed" };
  }
  return result;
};

const withWallpaperProvider = (
  result: FinishedEditorSessionResult,
  wallpaperProvider: WallpaperProviderKind,
): DeskDoodleCommandResult => {
  if (result.kind === "saved") {
    return { ...result, wallpaperProvider };
  }
  return result;
};

const reportCommandResult = (result: DeskDoodleCommandResult): void => {
  switch (result.kind) {
    case "cleared":
      logSuccess("removed doodles");
      return;
    case "reset":
      logSuccess(`restored original wallpaper with ${pc.bold(result.wallpaperProvider)}`);
      return;
    case "saved":
      logSuccess(`saved wallpaper with ${pc.bold(result.wallpaperProvider)}`);
      return;
    case "canceled":
      logWarning("canceled");
      return;
    case "closed":
      logWarning("closed without saving");
      return;
    case "failed":
      logError(`failed: ${result.message}`);
      return;
  }
};
