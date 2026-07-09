import type { Paths } from "./paths";
import type { BrowserLaunch, BrowserProvider } from "./providers/browser/index";
import type { WallpaperProvider } from "./providers/wallpaper/index";
import { startEditorServer, type SessionOutcome } from "./editor-server";
import type { State } from "./state";

export type { SessionOutcome } from "./editor-server";

export type EditorSessionDeps = {
  readonly state: State;
  readonly wallpaper: WallpaperProvider;
  readonly browser: BrowserProvider;
  readonly paths: Paths;
  readonly onOpened: (url: string) => void;
};

/**
 * Runs one editing session start to finish: serves the editor, opens the browser, and
 * waits for whichever happens first — the editor finishing, the browser exiting, or the
 * user interrupting. Owns every resource it creates and tears them all down before
 * returning.
 */
export const runEditorSession = async (deps: EditorSessionDeps): Promise<SessionOutcome> => {
  const { state, wallpaper, browser, paths, onOpened } = deps;
  const server = await startEditorServer({ state, wallpaper, paths });

  const interrupts = new AbortController();
  let launch: BrowserLaunch | null = null;

  try {
    launch = await browser.launch(paths, server.url);
    onOpened(server.url);

    return await Promise.race([
      server.finished,
      browserExited(launch, interrupts.signal),
      interrupted(interrupts.signal),
    ]);
  } finally {
    interrupts.abort();
    if (launch?.kind === "managed") {
      launch.process.kill("SIGTERM");
    }
    await server.close();
  }
};

/**
 * A managed browser closing means the user closed the window. An unmanaged one
 * (xdg-open) exits immediately after handing off the URL, so it never resolves.
 */
const browserExited = (launch: BrowserLaunch, signal: AbortSignal): Promise<SessionOutcome> => {
  if (launch.kind !== "managed") {
    return never();
  }

  return new Promise<SessionOutcome>((resolve) => {
    const onExit = (): void => resolve({ kind: "closed" });
    // A browser that hands off to an already-running instance exits at once; give the
    // editor a moment to report a save before treating that exit as a close.
    launch.process.once("exit", () => setTimeout(onExit, 200));
    launch.process.once("error", onExit);
    signal.addEventListener("abort", () => resolve({ kind: "closed" }), { once: true });
  });
};

const interrupted = (signal: AbortSignal): Promise<SessionOutcome> => {
  return new Promise<SessionOutcome>((resolve) => {
    const onSignal = (): void => resolve({ kind: "canceled" });
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    signal.addEventListener(
      "abort",
      () => {
        process.off("SIGINT", onSignal);
        process.off("SIGTERM", onSignal);
      },
      { once: true },
    );
  });
};

const never = (): Promise<never> => new Promise<never>(() => {});
