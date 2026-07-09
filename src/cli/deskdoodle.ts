#!/usr/bin/env node
import { Command } from "commander";
import type { ChildProcess } from "node:child_process";
import pc from "picocolors";
import { applyGnomeWallpaper, restoreGnomeWallpaper } from "../server/gnome.js";
import { openEditorBrowser } from "../server/browser.js";
import {
  startEditorServer,
  type EditorSessionResult,
  type FinishedEditorSessionResult,
} from "../server/editor-server.js";
import { clearLayerFiles, prepareState } from "../server/state.js";
import { commandExists } from "../server/commands.js";

type CliAction = { readonly kind: "open" } | { readonly kind: "clear" } | { readonly kind: "reset" };

type RequiredCommand = {
  readonly command: string;
  readonly installHint: string;
  readonly reason: string;
};

const requiredCommands = [
  {
    command: "gsettings",
    installHint: "GLib / GNOME settings tools",
    reason: "read and apply GNOME wallpaper settings",
  },
  {
    command: "gdbus",
    installHint: "GLib / GNOME D-Bus tools",
    reason: "read the primary monitor size from Mutter",
  },
  {
    command: "magick",
    installHint: "ImageMagick",
    reason: "render and composite wallpaper PNGs",
  },
] as const satisfies readonly RequiredCommand[];

const formatHelp = (command: Command): string => {
  if (command.parent) {
    return formatSubcommandHelp(command);
  }
  return formatRootHelp();
};

const formatRootHelp = (): string => {
  const lines = [
    title("deskdoodle"),
    "",
    body("Open an editable doodle layer over your GNOME wallpaper."),
    "",
    section("Usage"),
    commandRow("deskdoodle", "open the editor"),
    commandRow("deskdoodle clear", "remove doodles and apply the clean base"),
    commandRow("deskdoodle reset", "restore the original GNOME wallpaper"),
    "",
    section("Options"),
    optionRow("-h, --help", "show help"),
    "",
    section("Editor Shortcuts"),
    keyRow("Ctrl+S", "save, apply, and close"),
    keyRow("Esc", "close without applying"),
    "",
    section("Requirements"),
    textRow("GNOME, local file wallpaper, ImageMagick, gsettings, gdbus"),
  ];

  return `${lines.join("\n")}\n`;
};

const formatSubcommandHelp = (command: Command): string => {
  const name = command.name();
  const description = command.description();
  const lines = [
    title(`deskdoodle ${name}`),
    "",
    body(description),
    "",
    section("Usage"),
    commandRow(`deskdoodle ${name}`, description),
    "",
    section("Options"),
    optionRow("-h, --help", "show help"),
  ];

  return `${lines.join("\n")}\n`;
};

const title = (value: string): string => {
  return `${pc.bold(pc.yellow("desk"))}${pc.bold(pc.white(value.slice("desk".length)))}`;
};

const section = (value: string): string => {
  return `  ${pc.bold(pc.white(`${value}:`))}`;
};

const commandRow = (command: string, description: string): string => {
  return row(pc.white(command.padEnd(24)), description);
};

const optionRow = (option: string, description: string): string => {
  return row(pc.white(option.padEnd(24)), description);
};

const keyRow = (key: string, description: string): string => {
  return row(pc.white(key.padEnd(24)), description);
};

const textRow = (text: string): string => {
  return `    ${text}`;
};

const row = (left: string, right: string): string => {
  return `    ${left} ${right}`;
};

const body = (text: string): string => {
  return `  ${text}`;
};

const main = async (): Promise<void> => {
  const program = new Command()
    .name("deskdoodle")
    .usage("[command]")
    .description("Open an editable doodle layer over your GNOME wallpaper.")
    .helpOption("-h, --help", "show help")
    .showHelpAfterError()
    .configureHelp({
      formatHelp: (command) => formatHelp(command),
    })
    .configureOutput({
      outputError: (message, write) => {
        write(`${prefix} ${pc.red(message.trim())}\n`);
      },
    })
    .action(() => {
      void run({ kind: "open" }).catch(handleError);
    });

  program
    .command("clear")
    .description("remove doodles and apply the clean base")
    .action(() => {
      void run({ kind: "clear" }).catch(handleError);
    });

  program
    .command("reset")
    .description("restore the pre-DeskDoodle GNOME wallpaper")
    .action(() => {
      void run({ kind: "reset" }).catch(handleError);
    });

  await program.parseAsync(process.argv);
};

const run = async (action: CliAction): Promise<void> => {
  await checkRuntimeDependencies(action);

  const state = await prepareState();

  if (action.kind === "clear") {
    await clearLayerFiles(state);
    await applyGnomeWallpaper(state.paths.basePath);
    logSuccess("layer cleared");
    return;
  }

  if (action.kind === "reset") {
    await restoreGnomeWallpaper(state.originalPictureUri, state.originalPictureUriDark);
    logSuccess("original GNOME wallpaper restored");
    return;
  }

  let browserProcess: ChildProcess | null = null;
  let shuttingDown = false;

  const server = await startEditorServer(state, () => void shutdown());

  const shutdown = async (fallbackResult?: FinishedEditorSessionResult): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    try {
      if (fallbackResult && server.result().kind === "open") {
        server.closeAs(fallbackResult);
      }
      browserProcess?.kill("SIGTERM");
      await server.close();
      reportEditorResult(finalResult(server.result()));
    } finally {
      process.exit(server.result().kind === "failed" ? 1 : 0);
    }
  };

  browserProcess = await openEditorBrowser(state, server.url);
  browserProcess?.once("exit", () => {
    setTimeout(() => void shutdown({ kind: "closed" }), 200);
  });
  browserProcess?.once("error", () => void shutdown({ kind: "closed" }));
  process.once("SIGINT", () => void shutdown({ kind: "canceled" }));
  process.once("SIGTERM", () => void shutdown({ kind: "canceled" }));
  logInfo(`editor opened ${link(server.url)}`);
};

const checkRuntimeDependencies = async (action: CliAction): Promise<void> => {
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

  const hasFirefox = await commandExists("firefox");
  const hasXdgOpen = await commandExists("xdg-open");

  if (missingRequired.length === 0 && (action.kind !== "open" || hasFirefox || hasXdgOpen)) {
    return;
  }

  const lines = ["missing runtime dependencies:"];

  for (const missing of missingRequired) {
    lines.push(`  ${missing.command} (${missing.installHint}) - needed to ${missing.reason}`);
  }

  if (action.kind === "open" && !hasFirefox && !hasXdgOpen) {
    lines.push("  firefox or xdg-open - needed to open the editor");
  }

  throw new Error(lines.join("\n"));
};

const handleError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  logError(message);
  process.exit(1);
};

const finalResult = (result: EditorSessionResult): FinishedEditorSessionResult => {
  if (result.kind === "open") {
    return { kind: "closed" };
  }
  return result;
};

const reportEditorResult = (result: FinishedEditorSessionResult): void => {
  switch (result.kind) {
    case "saved":
      logSuccess("saved and applied wallpaper");
      return;
    case "canceled":
      logWarning("canceled - wallpaper unchanged");
      return;
    case "closed":
      logWarning("closed without saving");
      return;
    case "failed":
      logError(`failed - ${result.message}`);
      return;
  }
};

const prefix = `${pc.bold(pc.yellow("desk"))}${pc.bold(pc.white("doodle"))}${pc.yellow(":")}`;

const logInfo = (message: string): void => {
  console.log(`${prefix} ${message}`);
};

const logSuccess = (message: string): void => {
  console.log(`${prefix} ${pc.green(message)}`);
};

const logWarning = (message: string): void => {
  console.log(`${prefix} ${pc.yellow(message)}`);
};

const logError = (message: string): void => {
  console.error(`${prefix} ${pc.red(message)}`);
};

const link = (url: string): string => {
  return pc.underline(url);
};

main().catch(handleError);
