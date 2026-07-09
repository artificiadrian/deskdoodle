import { convertToExcalidrawElements, exportToBlob } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { Monitor, SceneJson } from "../shared/protocol";

type Theme = AppState["theme"];
type SceneElements = ReturnType<ExcalidrawImperativeAPI["getSceneElements"]>;

/** Excalidraw's own persisted-scene shape. The only place we assume it. */
type StoredScene = {
  readonly elements?: ExcalidrawInitialDataState["elements"];
  readonly appState?: ExcalidrawInitialDataState["appState"];
  readonly files?: BinaryFiles;
};

export type SceneSnapshot = {
  readonly elements: SceneElements;
  readonly appState: AppState;
  readonly files: BinaryFiles;
};

export type Size = { readonly width: number; readonly height: number };

/**
 * The zoom that shows the whole wallpaper. Excalidraw's default 1:1 zoom overflows any
 * viewport smaller than the monitor, which is every viewport once browser chrome or
 * fractional scaling is involved.
 */
export const fitZoom = (monitor: Size, viewport: Size): number => {
  return Math.min(1, viewport.width / monitor.width, viewport.height / monitor.height);
};

export const initialSceneData = (
  scene: SceneJson | null,
  monitor: Monitor,
  viewport: Size,
  theme: Theme,
): ExcalidrawInitialDataState => {
  const stored = scene as StoredScene | null;
  const zoom = fitZoom(monitor, viewport) as AppState["zoom"]["value"];

  return {
    elements: stored?.elements ?? [],
    appState: {
      ...stripRuntimeAppState(stored?.appState),
      viewBackgroundColor: "transparent",
      exportBackground: false,
      exportWithDarkMode: false,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: zoom },
      theme,
    },
    files: stored?.files ?? {},
  };
};

/** The scene as persisted to `layer.excalidraw`. */
export const toSceneJson = (snapshot: SceneSnapshot): SceneJson => {
  return {
    type: "excalidraw",
    version: 2,
    source: "deskdoodle",
    elements: snapshot.elements,
    appState: stripRuntimeAppState(snapshot.appState),
    files: snapshot.files,
  };
};

/**
 * Renders the doodle layer at exactly the monitor's pixel size.
 *
 * The transparent bounds rectangle anchors the export frame at the scene origin.
 * `getDimensions` alone would only resize the canvas around whatever bounding box the
 * drawn elements happen to occupy, so doodles would drift and scale.
 */
export const renderLayerPng = async (
  snapshot: SceneSnapshot,
  monitor: Monitor,
): Promise<Blob> => {
  const bounds = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        id: "deskdoodle-export-bounds",
        x: 0,
        y: 0,
        width: monitor.width,
        height: monitor.height,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        opacity: 0,
        roughness: 0,
        strokeWidth: 0,
      },
    ],
    { regenerateIds: false },
  );

  return exportToBlob({
    elements: [...bounds, ...snapshot.elements],
    appState: {
      ...snapshot.appState,
      exportBackground: false,
      viewBackgroundColor: "transparent",
      exportWithDarkMode: false,
    },
    files: snapshot.files,
    exportPadding: 0,
    getDimensions: () => ({ width: monitor.width, height: monitor.height, scale: 1 }),
    mimeType: "image/png",
  });
};

/** Base64-encodes the PNG bytes for the JSON request body. */
export const blobToBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

/** Drops the fields Excalidraw refuses to rehydrate, and the theme we take from the OS. */
const stripRuntimeAppState = (
  appState: ExcalidrawInitialDataState["appState"] | AppState | undefined,
): ExcalidrawInitialDataState["appState"] => {
  if (!appState) {
    return {};
  }

  const { collaborators: _collaborators, theme: _theme, ...persisted } = appState;
  return persisted;
};
