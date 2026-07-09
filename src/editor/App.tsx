import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Excalidraw,
  exportToBlob,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { EditorBootstrap, ExcalidrawSceneFile } from "../shared/types.js";
import { discardSession, fetchBootstrap, readToken, saveWallpaper } from "./api.js";
import "@excalidraw/excalidraw/index.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function App(): ReactElement {
  const [bootstrap, setBootstrap] = useState<EditorBootstrap | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => readToken(), []);

  useEffect(() => {
    void fetchBootstrap(token)
      .then(setBootstrap)
      .catch((unknownError: unknown) => {
        setError(unknownError instanceof Error ? unknownError.message : String(unknownError));
      });
  }, [token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (bootstrap && api) {
          void save(api, bootstrap, token, setStatus, setError);
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        void discardSession(token).finally(() => window.close());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [api, bootstrap, token]);

  if (error) {
    return <main className="message error">{error}</main>;
  }

  if (!bootstrap) {
    return <main className="message">Loading DeskDoodle...</main>;
  }

  const initialData: ExcalidrawInitialDataState = {
    elements: bootstrap.scene?.elements ?? [],
    appState: {
      ...(bootstrap.scene?.appState ?? {}),
      viewBackgroundColor: "transparent",
      exportBackground: false,
      exportWithDarkMode: false,
      scrollX: 0,
      scrollY: 0,
    },
    files: bootstrap.scene?.files ?? {},
  };

  return (
    <main className="deskdoodle">
      <img className="wallpaper" src={bootstrap.baseUrl} alt="" draggable={false} />
      <div className="canvas">
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={setApi}
          zenModeEnabled
          gridModeEnabled={false}
        />
      </div>
      <div className="status" data-state={status}>
        {statusLabel(status)}
      </div>
    </main>
  );
}

async function save(
  api: ExcalidrawImperativeAPI,
  bootstrap: EditorBootstrap,
  token: string,
  setStatus: (status: SaveStatus) => void,
  setError: (error: string | null) => void,
): Promise<void> {
  setStatus("saving");
  setError(null);

  const elements = api.getSceneElements();
  const appState = api.getAppState();
  const files = api.getFiles();
  const bounds = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        id: "deskdoodle-export-bounds",
        x: 0,
        y: 0,
        width: bootstrap.monitor.width,
        height: bootstrap.monitor.height,
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
    elements: [...bounds, ...elements],
    appState: {
      ...appState,
      exportBackground: false,
      viewBackgroundColor: "transparent",
      exportWithDarkMode: false,
    },
    files,
    exportPadding: 0,
    getDimensions: () => ({
      width: bootstrap.monitor.width,
      height: bootstrap.monitor.height,
      scale: 1,
    }),
    mimeType: "image/png",
  });

  const scene: ExcalidrawSceneFile = {
    type: "excalidraw",
    version: 2,
    source: "deskdoodle",
    elements,
    appState,
    files,
  };

  await saveWallpaper(token, {
    scene,
    layerPngDataUrl: await blobToDataUrl(blob),
  });

  setStatus("saved");
  window.close();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read exported layer."));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case "idle":
      return "Ctrl+S save - Esc discard";
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
  }
}
