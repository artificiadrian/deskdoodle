import type { ChildProcess } from "node:child_process";
import type { BrowserSelectionKind, DeskDoodlePaths } from "../../../shared/types";

export type BrowserLaunch =
  | { readonly kind: "managed"; readonly process: ChildProcess }
  | { readonly kind: "unmanaged" };

export type BrowserProvider = {
  readonly kind: Exclude<BrowserSelectionKind, "auto">;
  readonly command: string;
  readonly available: () => Promise<boolean>;
  readonly launch: (paths: DeskDoodlePaths, url: string) => Promise<BrowserLaunch>;
};
