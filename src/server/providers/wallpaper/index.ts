import type { Failure, Success, Unavailable } from "../../result";
import { gnomeWallpaperProvider } from "./gnome";
import type { BackendSelection, WallpaperKind, WallpaperProvider } from "./types";
import { wallpaperKinds } from "./types";

export type {
  BackendSelection,
  Capture,
  WallpaperKind,
  WallpaperProvider,
} from "./types";
export { backendSelectionKinds, backendSelectionSchema, wallpaperKinds } from "./types";

/** The registry. A new backend is a file plus one entry here. */
const providers: Readonly<Record<WallpaperKind, WallpaperProvider>> = {
  gnome: gnomeWallpaperProvider,
};

/** The provider a saved session was created with. */
export const providerForKind = (kind: WallpaperKind): WallpaperProvider => providers[kind];

/** The chosen backend is installed and usable. */
export type ResolvedWallpaper = Success & { readonly provider: WallpaperProvider };

/** The chosen backend is missing its tools; `needs` says which. */
export type WallpaperUnavailable = Unavailable & { readonly kind: WallpaperKind };

/** `auto` found no usable backend at all. */
export type NoWallpaperBackend = Failure & {
  readonly error: "noBackend";
  readonly tried: readonly WallpaperKind[];
};

export type ResolveWallpaperResult =
  | ResolvedWallpaper
  | WallpaperUnavailable
  | NoWallpaperBackend;

export const resolveWallpaperProvider = async (
  selection: BackendSelection,
): Promise<ResolveWallpaperResult> => {
  if (selection !== "auto") {
    const provider = providers[selection];
    const availability = await provider.available();
    if (!availability.success) {
      return { ...availability, kind: provider.kind };
    }
    return { success: true, provider };
  }

  for (const kind of wallpaperKinds) {
    const provider = providers[kind];
    if ((await provider.available()).success) {
      return { success: true, provider };
    }
  }

  return { success: false, error: "noBackend", tried: wallpaperKinds };
};
