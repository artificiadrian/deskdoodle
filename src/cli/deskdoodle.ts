#!/usr/bin/env node
import { applyGnomeWallpaper, restoreGnomeWallpaper } from "../server/gnome.js";
import { openEditorBrowser } from "../server/browser.js";
import { startEditorServer } from "../server/editor-server.js";
import { clearLayerFiles, prepareState } from "../server/state.js";
import type { ChildProcess } from "node:child_process";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const state = await prepareState();

  if (args.includes("--clear")) {
    await clearLayerFiles(state);
    await applyGnomeWallpaper(state.paths.basePath);
    console.log("DeskDoodle layer cleared.");
    return;
  }

  if (args.includes("--reset")) {
    await restoreGnomeWallpaper(state.originalPictureUri, state.originalPictureUriDark);
    console.log("Original GNOME wallpaper restored.");
    return;
  }

  let browserProcess: ChildProcess | null = null;

  const server = await startEditorServer(state, () => {
    setTimeout(() => {
      browserProcess?.kill("SIGTERM");
      void server.close().finally(() => process.exit(0));
    }, 250);
  });

  browserProcess = await openEditorBrowser(state, server.url);
  console.log(`DeskDoodle editor: ${server.url}`);
}

function printHelp(): void {
  console.log(`Usage:
  deskdoodle          open the editor
  deskdoodle --clear  remove doodles and apply the clean base
  deskdoodle --reset  restore the pre-DeskDoodle GNOME wallpaper`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`deskdoodle: ${message}`);
  process.exit(1);
});
