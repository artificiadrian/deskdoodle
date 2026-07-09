import type { BrowserSelection, DeskDoodlePaths } from "../../../shared/types";
import { chromiumBrowserProvider } from "./chromium";
import { customBrowserProvider } from "./custom";
import { firefoxBrowserProvider } from "./firefox";
import type { BrowserLaunch, BrowserProvider } from "./types";
import { xdgOpenBrowserProvider } from "./xdg-open";

export type { BrowserLaunch, BrowserProvider } from "./types";

export const resolveBrowserProvider = async (
  selection: BrowserSelection,
): Promise<BrowserProvider> => {
  switch (selection.kind) {
    case "auto":
      return resolveAutoBrowserProvider();
    case "firefox-kiosk":
      return requireBrowserProvider(firefoxBrowserProvider);
    case "chromium-app":
      return requireBrowserProvider(await chromiumBrowserProvider());
    case "xdg-open":
      return requireBrowserProvider(xdgOpenBrowserProvider);
    case "custom":
      return requireBrowserProvider(customBrowserProvider(selection.command, selection.args));
  }
};

export const openEditorBrowser = async (
  provider: BrowserProvider,
  paths: DeskDoodlePaths,
  url: string,
): Promise<BrowserLaunch> => {
  return provider.launch(paths, url);
};

const resolveAutoBrowserProvider = async (): Promise<BrowserProvider> => {
  const providers = [
    firefoxBrowserProvider,
    await chromiumBrowserProvider(),
    xdgOpenBrowserProvider,
  ];

  for (const provider of providers) {
    if (await provider.available()) {
      return provider;
    }
  }

  throw new Error("Missing browser launcher: install firefox, chromium, google-chrome, or xdg-open.");
};

const requireBrowserProvider = async (provider: BrowserProvider): Promise<BrowserProvider> => {
  if (await provider.available()) {
    return provider;
  }
  throw new Error(`Missing browser launcher: ${provider.command}.`);
};
