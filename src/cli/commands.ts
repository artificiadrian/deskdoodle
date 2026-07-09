import { fileURLToPath } from "node:url";
import { Argument, Command } from "commander";
import pc from "picocolors";
import { getConfigPath, readConfig, writeConfig, type Config } from "../server/config";
import { runEditorSession, type SessionOutcome } from "../server/editor-session";
import { requireAllCommands } from "../server/exec";
import { getPaths, type Paths } from "../server/paths";
import type { Monitor } from "../shared/protocol";
import {
  browserSelectionKinds,
  browserSelectionSchema,
  resolveBrowserProvider,
  type BrowserProvider,
  type BrowserSelection,
  type ResolveBrowserResult,
} from "../server/providers/browser/index";
import {
  backendSelectionKinds,
  backendSelectionSchema,
  providerForKind,
  resolveWallpaperProvider,
  type ResolveWallpaperResult,
  type WallpaperProvider,
} from "../server/providers/wallpaper/index";
import { clearLayerFiles, prepareState, readState } from "../server/state";
import {
  describeNeeds,
  handleError,
  helpStyle,
  link,
  logError,
  logInfo,
  logSuccess,
  logWarning,
  rootHelpText,
  writeCommanderError,
} from "./ui";

export const createProgram = (): Command => {
  const program = new Command()
    .name("deskdoodle")
    .usage("[command]")
    .description("Draw on your wallpaper, then save it as the desktop background.")
    .helpOption("-h, --help", "show help")
    .showHelpAfterError()
    .configureHelp(helpStyle)
    .addHelpText("after", rootHelpText)
    .configureOutput({ outputError: writeCommanderError })
    .action(() => run(openEditor));

  program
    .command("clear")
    .usage("")
    .description("remove saved doodles")
    .action(() => run(clearDoodles));

  program
    .command("reset")
    .usage("")
    .description("restore the original wallpaper")
    .action(() => run(resetWallpaper));

  program
    .command("check")
    .usage("")
    .description("check providers and required tools")
    .action(() => run(checkSetup));

  const config = program.command("config").description("show or change saved choices");

  config
    .command("show")
    .usage("")
    .description("show saved choices")
    .action(() => run(showConfig));

  const configSet = config.command("set").description("change a saved choice");

  configSet
    .command("backend")
    .usage("<backend>")
    .addArgument(
      new Argument("<backend>", "wallpaper provider").choices([...backendSelectionKinds]),
    )
    .description("set wallpaper provider")
    .action((backend: string) => run(() => setBackend(backend)));

  configSet
    .command("browser")
    .usage("<browser> [command] [args...]")
    .addArgument(new Argument("<browser>", "browser launcher").choices([...browserSelectionKinds]))
    .argument("[command]", "custom browser command")
    .argument("[args...]", "custom browser arguments; use {url} for the editor URL")
    .allowUnknownOption(true)
    .description("set browser launcher")
    .action((browser: string, command: string | undefined, args: string[]) =>
      run(() => setBrowser(browser, command, args)),
    );

  return program;
};

const run = (action: () => Promise<void>): void => {
  void action().catch(handleError);
};

const openEditor = async (): Promise<void> => {
  const config = await readConfig();
  await requireImageMagick();

  const paths = getPaths();
  const { state, wallpaper } = await prepareState(await requireWallpaper(config));

  // The saved session pins the provider, because only that provider can read its restore
  // blob. Switching providers goes through `reset`, which never reaches this check.
  if (config.backend !== "auto" && config.backend !== state.backend) {
    throw new Error(
      [
        `config selects the ${config.backend} wallpaper provider, but the saved session uses ${state.backend}.`,
        'Run "deskdoodle reset" to restore the original wallpaper before switching providers.',
      ].join("\n"),
    );
  }

  const browser = await requireBrowser(config);
  const outcome = await runEditorSession({
    state,
    wallpaper,
    browser,
    paths,
    onOpened: (url) => logInfo(`opened editor ${link(url)} with ${pc.bold(browser.kind)}`),
  });

  reportOutcome(outcome, wallpaper);
};

const clearDoodles = async (): Promise<void> => {
  const config = await readConfig();
  await requireImageMagick();

  const paths = getPaths();
  const { wallpaper } = await prepareState(await requireWallpaper(config));

  await clearLayerFiles(paths);
  await wallpaper.apply(paths.basePath);
  logSuccess("removed doodles");
};

/** Never renders or captures: reset has to work even when the base image is gone. */
const resetWallpaper = async (): Promise<void> => {
  const state = await readState(getPaths());
  if (!state) {
    throw new Error("There is no DeskDoodle session to reset.");
  }

  const wallpaper = providerForKind(state.backend);
  await wallpaper.restore(state.restore);
  logSuccess(`restored original wallpaper with ${pc.bold(wallpaper.kind)}`);
};

const reportOutcome = (outcome: SessionOutcome, wallpaper: WallpaperProvider): void => {
  switch (outcome.kind) {
    case "saved":
      logSuccess(`saved wallpaper with ${pc.bold(wallpaper.kind)}`);
      return;
    case "canceled":
      logWarning("canceled");
      return;
    case "closed":
      logWarning("closed without saving");
      return;
    case "failed":
      logError(`failed: ${outcome.message}`);
      process.exitCode = 1;
      return;
  }
};

const requireImageMagick = async (): Promise<void> => {
  const availability = await requireAllCommands(["magick"]);
  if (!availability.success) {
    throw new Error(
      `DeskDoodle ${describeNeeds(availability.needs)} to render wallpapers (install ImageMagick).`,
    );
  }
};

const requireWallpaper = async (config: Config): Promise<WallpaperProvider> => {
  const resolved = await resolveWallpaperProvider(config.backend);
  if (!resolved.success) {
    throw new Error(describeWallpaperFailure(resolved));
  }
  return resolved.provider;
};

const requireBrowser = async (config: Config): Promise<BrowserProvider> => {
  const resolved = await resolveBrowserProvider(config.browser);
  if (!resolved.success) {
    throw new Error(describeBrowserFailure(resolved));
  }
  return resolved.provider;
};

const describeWallpaperFailure = (
  failure: Exclude<ResolveWallpaperResult, { success: true }>,
): string => {
  if (failure.error === "noBackend") {
    return `No supported wallpaper provider found (tried ${failure.tried.join(", ")}).`;
  }
  return `The ${failure.kind} wallpaper provider ${describeNeeds(failure.needs)}.`;
};

const describeBrowserFailure = (
  failure: Exclude<ResolveBrowserResult, { success: true }>,
): string => {
  if (failure.error === "noLauncher") {
    return `No browser launcher found (tried ${failure.tried.join(", ")}).`;
  }
  return `The ${failure.kind} browser launcher ${describeNeeds(failure.needs)}.`;
};

const checkSetup = async (): Promise<void> => {
  const config = await readConfig();
  const paths = getPaths();
  const rows: (readonly [string, string])[] = [
    ["config", getConfigPath()],
    ["shared folder", paths.dataDir],
  ];

  const imageMagick = await requireAllCommands(["magick"]);
  rows.push(["ImageMagick", imageMagick.success ? pc.bold("available") : missing("missing")]);

  const browser = await resolveBrowserProvider(config.browser);
  rows.push([
    "browser launcher",
    browser.success ? pc.bold(browser.provider.kind) : missing(describeBrowserFailure(browser)),
  ]);

  const wallpaper = await resolveWallpaperProvider(config.backend);
  rows.push([
    "wallpaper provider",
    wallpaper.success ? pc.bold(wallpaper.provider.kind) : missing(describeWallpaperFailure(wallpaper)),
  ]);

  if (wallpaper.success) {
    const desktop = await describeDesktop(wallpaper.provider, paths);
    rows.push(["monitor", desktop.monitor], ["wallpaper", desktop.wallpaper]);
  }

  logInfo("check");
  console.log(formatRows(rows));

  if (imageMagick.success && browser.success && wallpaper.success) {
    logSuccess(pc.bold("everything is ready"));
    return;
  }

  logError(pc.bold("setup needs attention"));
  process.exitCode = 1;
};

/**
 * Reports the live monitor and the wallpaper we would build from. Once a session exists,
 * the desktop's wallpaper is one of ours, so the saved original is the honest answer.
 */
const describeDesktop = async (
  wallpaper: WallpaperProvider,
  paths: Paths,
): Promise<{ readonly monitor: string; readonly wallpaper: string }> => {
  try {
    const state = await readState(paths);
    const { monitor, source } = state
      ? { monitor: await wallpaper.readMonitor(), source: state.baseSource }
      : await capturedDesktop(wallpaper);

    return { monitor: `${monitor.width}x${monitor.height} ${monitor.name}`, wallpaper: source };
  } catch (error) {
    const reason = error instanceof Error ? (error.message.split("\n")[0] ?? "") : "";
    return { monitor: missing("unavailable"), wallpaper: missing(reason || "unavailable") };
  }
};

const capturedDesktop = async (
  wallpaper: WallpaperProvider,
): Promise<{ readonly monitor: Monitor; readonly source: string }> => {
  const capture = await wallpaper.capture();
  return { monitor: capture.monitor, source: displayPath(capture.sourceUri) };
};

const showConfig = async (): Promise<void> => {
  const config = await readConfig();
  logInfo(`config ${link(getConfigPath())}`);
  console.log(
    formatRows([
      ["wallpaper provider", pc.bold(config.backend)],
      ["browser launcher", pc.bold(describeBrowser(config.browser))],
    ]),
  );
};

const setBackend = async (backend: string): Promise<void> => {
  const config = await readConfig();
  const next: Config = { ...config, backend: backendSelectionSchema.parse(backend) };
  await writeConfig(next);
  logSuccess(`saved wallpaper provider ${pc.bold(next.backend)}`);
};

const setBrowser = async (
  browser: string,
  command: string | undefined,
  args: readonly string[],
): Promise<void> => {
  if (browser === "custom" && !command) {
    throw new Error("A custom browser launcher requires a command.");
  }

  const selection = browserSelectionSchema.parse(
    browser === "custom" ? { kind: browser, command, args: [...args] } : { kind: browser },
  );

  const config = await readConfig();
  await writeConfig({ ...config, browser: selection });
  logSuccess(`saved browser launcher ${pc.bold(describeBrowser(selection))}`);
};

const describeBrowser = (browser: BrowserSelection): string => {
  if (browser.kind !== "custom") {
    return browser.kind;
  }
  return `custom ${browser.command} ${browser.args.join(" ")}`.trimEnd();
};

const displayPath = (uri: string): string => {
  if (!uri.startsWith("file://")) {
    return uri;
  }
  try {
    return fileURLToPath(uri);
  } catch {
    return uri;
  }
};

const missing = (value: string): string => pc.bold(pc.red(value));

const formatRows = (rows: readonly (readonly [string, string])[]): string => {
  const width = rows.reduce((widest, [label]) => Math.max(widest, label.length), 0);
  return rows.map(([label, value]) => `  ${pc.white(label.padEnd(width))}  ${value}`).join("\n");
};
