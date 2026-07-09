import { commandExists } from "../../commands";
import {
  applyGnomeWallpaper,
  getPrimaryMonitorGeometry,
  readGnomeWallpaperSettings,
  restoreGnomeWallpaper,
  wallpaperUriToPath,
} from "../../gnome";
import type { WallpaperProvider } from "./types";

export const gnomeWallpaperProvider: WallpaperProvider = {
  kind: "gnome",
  available: async () => {
    const [hasGSettings, hasGdbus] = await Promise.all([
      commandExists("gsettings"),
      commandExists("gdbus"),
    ]);
    return hasGSettings && hasGdbus;
  },
  capture: async () => {
    const settings = await readGnomeWallpaperSettings();
    const monitor = await getPrimaryMonitorGeometry();
    return {
      backend: { kind: "gnome" },
      restoreTarget: {
        kind: "gnome",
        pictureUri: settings.pictureUri,
        pictureUriDark: settings.pictureUriDark,
      },
      baseSourceUri: settings.pictureUri,
      baseSourcePath: wallpaperUriToPath(settings.pictureUri),
      pictureOptions: settings.pictureOptions,
      monitor,
    };
  },
  apply: async (path) => {
    await applyGnomeWallpaper(path);
  },
  restore: async (state) => {
    if (state.restoreTarget.kind !== "gnome") {
      throw new Error("Cannot restore GNOME wallpaper from non-GNOME state.");
    }
    await restoreGnomeWallpaper(
      state.restoreTarget.pictureUri,
      state.restoreTarget.pictureUriDark,
    );
  },
};
