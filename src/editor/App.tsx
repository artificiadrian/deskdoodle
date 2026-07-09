import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Excalidraw,
  Footer,
  exportToBlob,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { EditorWorkspace, ExcalidrawSceneFile, PngDataUrl } from "../shared/types";
import { parsePngDataUrl } from "../shared/data-url";
import {
  applyWorkspace,
  closeSession,
  fetchEditorWorkspace,
  readToken,
  sessionCloseUrl,
} from "./api";
import "@excalidraw/excalidraw/index.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type PersistedAppState = NonNullable<ExcalidrawSceneFile["appState"]>;
type SceneElement = ReturnType<ExcalidrawImperativeAPI["getSceneElements"]>[number];
type Theme = AppState["theme"];
type WallpaperTransformState = Pick<
  AppState,
  "offsetLeft" | "offsetTop" | "scrollX" | "scrollY" | "zoom"
>;

const backgroundElementId = "deskdoodle-background";
const backgroundFileId = "deskdoodle-background-file";
const oneToOneZoom: AppState["zoom"] = {
  value: 1 as AppState["zoom"]["value"],
};

const App = (): ReactElement => {
  const [workspace, setWorkspace] = useState<EditorWorkspace | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => getSystemTheme());
  const wallpaperRef = useRef<HTMLImageElement | null>(null);

  const token = useMemo(() => readToken(), []);

  useEffect(() => {
    void fetchEditorWorkspace(token)
      .then(setWorkspace)
      .catch((unknownError: unknown) => {
        setLoadError(unknownError instanceof Error ? unknownError.message : String(unknownError));
      });
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const darkMode = window.matchMedia("(prefers-color-scheme: dark)");

    const syncTheme = (): void => setTheme(getSystemTheme());

    const closeEditorSession = (): void => {
      void fetch(sessionCloseUrl(token), { method: "DELETE", keepalive: true });
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (workspace && api) {
          void save(api, workspace, token, setStatus, setSaveError);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void closeSession(token).finally(() => window.close());
      }
    };

    window.addEventListener("keydown", onKeyDown, {
      capture: true,
      signal: controller.signal,
    });
    window.addEventListener("pagehide", closeEditorSession, {
      signal: controller.signal,
    });
    darkMode.addEventListener("change", syncTheme, {
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

  const initialData: ExcalidrawInitialDataState = {
    elements: (workspace.scene?.elements ?? []).filter((element) => !isBackgroundElement(element)),
    appState: {
      ...withoutRuntimeAppState(workspace.scene?.appState ?? {}),
      viewBackgroundColor: "transparent",
      exportBackground: false,
      exportWithDarkMode: false,
      scrollX: 0,
      scrollY: 0,
      zoom: oneToOneZoom,
      theme,
    },
    files: withoutBackgroundFile(workspace.scene?.files ?? {}),
  };

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
    </main>
  );
};

const save = async (
  api: ExcalidrawImperativeAPI,
  workspace: EditorWorkspace,
  token: string,
  setStatus: (status: SaveStatus) => void,
  setSaveError: (error: string | null) => void,
): Promise<void> => {
  setStatus("saving");
  setSaveError(null);

  try {
    const elements = api.getSceneElements();
    const layerElements = withoutBackgroundElements(elements);
    const appState = api.getAppState();
    const files = withoutBackgroundFile(api.getFiles());
    const bounds = convertToExcalidrawElements(
      [
        {
          type: "rectangle",
          id: "deskdoodle-export-bounds",
          x: 0,
          y: 0,
          width: workspace.monitor.width,
          height: workspace.monitor.height,
          strokeColor: "transparent",
          backgroundColor: "transparent",
          opacity: 0,
          roughness: 0,
          strokeWidth: 0,
        },
      ],
      { regenerateIds: false },
    );

    const blob = await exportToBlob({
      elements: [...bounds, ...layerElements],
      appState: {
        ...appState,
        exportBackground: false,
        viewBackgroundColor: "transparent",
        exportWithDarkMode: false,
      },
      files,
      exportPadding: 0,
      getDimensions: () => ({
        width: workspace.monitor.width,
        height: workspace.monitor.height,
        scale: 1,
      }),
      mimeType: "image/png",
    });

    const scene: ExcalidrawSceneFile = {
      type: "excalidraw",
      version: 2,
      source: "deskdoodle",
      elements: layerElements,
      appState: withoutRuntimeAppState(appState),
      files,
    };

    await applyWorkspace(token, {
      scene,
      layerPngDataUrl: await blobToPngDataUrl(blob),
    });

    setStatus("saved");
    window.close();
  } catch (unknownError) {
    setSaveError(unknownError instanceof Error ? unknownError.message : String(unknownError));
    setStatus("error");
  }
};

const isBackgroundElement = (element: { readonly id: string }): boolean => {
  return element.id === backgroundElementId;
};

const withoutBackgroundElements = (elements: readonly SceneElement[]): readonly SceneElement[] => {
  return elements.filter((element) => !isBackgroundElement(element));
};

const withoutBackgroundFile = (files: BinaryFiles): BinaryFiles => {
  const { [backgroundFileId]: _backgroundFile, ...layerFiles } = files;
  return layerFiles;
};

const syncWallpaperTransform = (
  wallpaper: HTMLImageElement | null,
  state: WallpaperTransformState,
): void => {
  if (!wallpaper) {
    return;
  }

  const zoom = state.zoom.value;
  const x = state.offsetLeft + state.scrollX * zoom;
  const y = state.offsetTop + state.scrollY * zoom;
  wallpaper.style.transform = `matrix(${zoom}, 0, 0, ${zoom}, ${x}, ${y})`;
};

const withoutRuntimeAppState = (
  appState: ExcalidrawSceneFile["appState"] | AppState,
): PersistedAppState => {
  if (!appState) {
    return {};
  }

  const appStateRecord: PersistedAppState = appState;
  const { collaborators: _collaborators, theme: _theme, ...serializableAppState } = appStateRecord;
  return serializableAppState;
};

const getSystemTheme = (): Theme => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const blobToPngDataUrl = (blob: Blob): Promise<PngDataUrl> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        try {
          resolve(parsePngDataUrl(reader.result));
          return;
        } catch (error) {
          reject(error);
          return;
        }
      }
      reject(new Error("Could not read exported layer."));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
};

const statusLabel = (status: SaveStatus): string => {
  switch (status) {
    case "idle":
      return "Ctrl+S to save. Esc to close.";
    case "saving":
      return "Applying doodle...";
    case "saved":
      return "Wallpaper updated";
    case "error":
      return "Could not save";
  }
};

export default App;
