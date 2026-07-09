import { homedir } from "node:os";
import { isAbsolute, join, relative } from "node:path";

export type Paths = {
  readonly dataDir: string;
  readonly basePath: string;
  readonly layerPath: string;
  readonly layerPngPath: string;
  readonly renderedPath: string;
  readonly statePath: string;
  readonly runtimeDir: string;
};

/** Every path DeskDoodle uses, derived from `$HOME`. Never persisted. */
export const getPaths = (): Paths => {
  const dataDir = join(homedir(), ".local", "share", "deskdoodle");

  return {
    dataDir,
    basePath: join(dataDir, "base.png"),
    layerPath: join(dataDir, "layer.excalidraw"),
    layerPngPath: join(dataDir, "layer.png"),
    renderedPath: join(dataDir, "rendered.png"),
    statePath: join(dataDir, "state.json"),
    runtimeDir: join(dataDir, "runtime"),
  };
};

/** True when `path` is `dir` itself or resolves to anything beneath it. */
export const isInsideDir = (dir: string, path: string): boolean => {
  const offset = relative(dir, path);
  return offset === "" || (!offset.startsWith("..") && !isAbsolute(offset));
};
