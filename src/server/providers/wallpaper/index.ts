import type { BackendSelection, DeskDoodleState } from "../../../shared/types";
import { gnomeWallpaperProvider } from "./gnome";
import type { WallpaperProvider } from "./types";

export type { WallpaperCapture, WallpaperProvider } from "./types";

export const resolveWallpaperProvider = async (
  selection: BackendSelection,
): Promise<WallpaperProvider> => {
  switch (selection.kind) {
    case "auto":
      return resolveAutoWallpaperProvider();
    case "gnome":
      return requireWallpaperProvider(gnomeWallpaperProvider);
  }
};

export const resolveWallpaperProviderForState = (
  state: DeskDoodleState,
): WallpaperProvider => {
  switch (state.backend.kind) {
    case "gnome":
      return gnomeWallpaperProvider;
  }
};

const resolveAutoWallpaperProvider = async (): Promise<WallpaperProvider> => {
  const providers = [gnomeWallpaperProvider];

  for (const provider of providers) {
    if (await provider.available()) {
      return provider;
    }
  }

  throw new Error("Missing wallpaper backend: GNOME requires gsettings and gdbus.");
};

const requireWallpaperProvider = async (
  provider: WallpaperProvider,
): Promise<WallpaperProvider> => {
  if (await provider.available()) {
    return provider;
  }
  throw new Error("Missing GNOME wallpaper backend dependencies: gsettings and gdbus.");
};
