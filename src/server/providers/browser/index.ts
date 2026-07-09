import type { Failure, Success, Unavailable } from "../../result";
import { chromiumBrowserProvider } from "./chromium";
import { customBrowserProvider } from "./custom";
import { firefoxBrowserProvider } from "./firefox";
import type { BrowserKind, BrowserProvider, BrowserSelection } from "./types";
import { xdgOpenBrowserProvider } from "./xdg-open";

export type {
  BrowserKind,
  BrowserLaunch,
  BrowserProvider,
  BrowserSelection,
} from "./types";
export { browserSelectionKinds, browserSelectionSchema } from "./types";

/** The chosen launcher is installed. */
export type ResolvedBrowser = Success & { readonly provider: BrowserProvider };

/** The chosen launcher is missing; `needs` says what it looked for. */
export type BrowserUnavailable = Unavailable & { readonly kind: BrowserKind };

/** `auto` found no usable launcher at all. */
export type NoBrowserLauncher = Failure & {
  readonly error: "noLauncher";
  readonly tried: readonly string[];
};

export type ResolveBrowserResult = ResolvedBrowser | BrowserUnavailable | NoBrowserLauncher;

export const resolveBrowserProvider = async (
  selection: BrowserSelection,
): Promise<ResolveBrowserResult> => {
  if (selection.kind === "auto") {
    return resolveAutoBrowserProvider();
  }

  const provider = await providerFor(selection);
  const availability = await provider.available();
  if (!availability.success) {
    return { ...availability, kind: provider.kind };
  }
  return { success: true, provider };
};

const providerFor = async (
  selection: Exclude<BrowserSelection, { kind: "auto" }>,
): Promise<BrowserProvider> => {
  switch (selection.kind) {
    case "firefox-kiosk":
      return firefoxBrowserProvider;
    case "chromium-app":
      return chromiumBrowserProvider();
    case "xdg-open":
      return xdgOpenBrowserProvider;
    case "custom":
      return customBrowserProvider(selection.command, selection.args);
  }
};

const resolveAutoBrowserProvider = async (): Promise<ResolveBrowserResult> => {
  const candidates = [
    firefoxBrowserProvider,
    await chromiumBrowserProvider(),
    xdgOpenBrowserProvider,
  ];

  for (const provider of candidates) {
    if ((await provider.available()).success) {
      return { success: true, provider };
    }
  }

  return {
    success: false,
    error: "noLauncher",
    tried: candidates.map((provider) => provider.command),
  };
};
