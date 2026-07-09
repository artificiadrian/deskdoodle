import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Excalidraw, Footer } from "@excalidraw/excalidraw";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { EditorWorkspace } from "../shared/protocol";
import { applyWorkspace, closeSession, fetchEditorWorkspace, readToken } from "./api";
import { blobToBase64, initialSceneData, renderLayerPng, toSceneJson, type Size } from "./scene";
import "@excalidraw/excalidraw/index.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type Theme = AppState["theme"];
type WallpaperTransform = Pick<AppState, "offsetLeft" | "offsetTop" | "scrollX" | "scrollY" | "zoom">;

type SaveResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

const App = (): ReactElement => {
  const [workspace, setWorkspace] = useState<EditorWorkspace | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getSystemTheme);
  const wallpaperRef = useRef<HTMLImageElement | null>(null);
  // Read from event handlers that must not re-register whenever `status` changes.
  const busyRef = useRef(false);

  const token = useMemo(readToken, []);

  useEffect(() => {
    void fetchEditorWorkspace(token)
      .then(setWorkspace)
      .catch((error: unknown) => setLoadError(messageOf(error)));
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const darkMode = window.matchMedia("(prefers-color-scheme: dark)");

    const beginSave = async (): Promise<void> => {
      if (!api || !workspace || busyRef.current) {
        return;
      }

      busyRef.current = true;
      setStatus("saving");
      setSaveError(null);

      // Exporting the canvas blocks the main thread. Without waiting for a frame, the
      // overlay would only appear once the work it announces has already finished.
      await nextPaint();

      const result = await saveWallpaper(api, workspace, token);
      if (result.ok) {
        setStatus("saved");
        window.close();
        return;
      }

      busyRef.current = false;
      setSaveError(result.message);
      setStatus("error");
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void beginSave();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (busyRef.current) {
          return;
        }
        void closeSession(token).finally(() => window.close());
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true, signal: controller.signal });
    window.addEventListener("pagehide", () => void closeSession(token, true), {
      signal: controller.signal,
    });
    darkMode.addEventListener("change", () => setTheme(getSystemTheme()), {
      signal: controller.signal,
    });

    return () => controller.abort();
  }, [api, token, workspace]);

  if (loadError) {
    return <main className="message error">{loadError}</main>;
  }

  if (!workspace) {
    return <main className="message">Loading DeskDoodle...</main>;
  }

  const initialData = initialSceneData(workspace.scene, workspace.monitor, viewport(), theme);

  return (
    <main className="deskdoodle">
      <img
        ref={wallpaperRef}
        className="wallpaper"
        src={workspace.baseImageUrl}
        alt=""
        width={workspace.monitor.width}
        height={workspace.monitor.height}
        draggable={false}
      />
      <div className="canvas">
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={(nextApi) => {
            setApi(nextApi);
            syncWallpaperTransform(wallpaperRef.current, nextApi.getAppState());
          }}
          gridModeEnabled={false}
          theme={theme}
          onScrollChange={(scrollX, scrollY, zoom) => {
            const appState = api?.getAppState();
            syncWallpaperTransform(wallpaperRef.current, {
              offsetLeft: appState?.offsetLeft ?? 0,
              offsetTop: appState?.offsetTop ?? 0,
              scrollX,
              scrollY,
              zoom,
            });
          }}
        >
          <Footer>
            <div className="status" data-state={status} title={saveError ?? ""}>
              {statusLabel(status)}
            </div>
          </Footer>
        </Excalidraw>
      </div>

      {isBusy(status) && (
        <div className="overlay" data-state={status} role="status" aria-live="polite">
          <div className="overlay-card">
            {status === "saving" && <span className="spinner" aria-hidden="true" />}
            <span>{statusLabel(status)}</span>
          </div>
        </div>
      )}
    </main>
  );
};

/** While saving, and after it succeeds, the scene is no longer editable. */
const isBusy = (status: SaveStatus): boolean => status === "saving" || status === "saved";

/** Resolves after the browser has painted, so blocking work cannot pre-empt the overlay. */
const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const saveWallpaper = async (
  api: ExcalidrawImperativeAPI,
  workspace: EditorWorkspace,
  token: string,
): Promise<SaveResult> => {
  try {
    const snapshot = {
      elements: api.getSceneElements(),
      appState: api.getAppState(),
      files: api.getFiles(),
    };

    const layer = await renderLayerPng(snapshot, workspace.monitor);
    await applyWorkspace(token, {
      scene: toSceneJson(snapshot),
      layerPngBase64: await blobToBase64(layer),
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
};

/** Keeps the wallpaper image locked to the canvas as it scrolls and zooms. */
const syncWallpaperTransform = (
  wallpaper: HTMLImageElement | null,
  state: WallpaperTransform,
): void => {
  if (!wallpaper) {
    return;
  }

  const zoom = state.zoom.value;
  const x = state.offsetLeft + state.scrollX * zoom;
  const y = state.offsetTop + state.scrollY * zoom;
  wallpaper.style.transform = `matrix(${zoom}, 0, 0, ${zoom}, ${x}, ${y})`;
};

const viewport = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

const getSystemTheme = (): Theme => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const messageOf = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const statusLabel = (status: SaveStatus): string => {
  switch (status) {
    case "idle":
      return "Ctrl+S to save. Esc to close.";
    case "saving":
      return "Applying doodles...";
    case "saved":
      return "Wallpaper updated";
    case "error":
      return "Could not save";
  }
};

export default App;
