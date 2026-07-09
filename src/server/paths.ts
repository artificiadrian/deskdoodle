import { homedir } from "node:os";
import { join } from "node:path";
import type { DeskDoodlePaths } from "../shared/types";

export const getPaths = (): DeskDoodlePaths => {
  const dataDir = join(homedir(), ".local", "share", "deskdoodle");
  const runtimeDir = join(dataDir, "runtime");

  return {
    dataDir,
    basePath: join(dataDir, "base.png"),
    layerPath: join(dataDir, "layer.excalidraw"),
    layerPngPath: join(dataDir, "layer.png"),
    renderedPath: join(dataDir, "rendered.png"),
    statePath: join(dataDir, "state.json"),
    runtimeDir,
  };
};
