import type { ChildProcess } from "node:child_process";
import { z } from "zod";
import type { Paths } from "../../paths";
import type { Availability } from "../../result";

export const browserSelectionKinds = [
  "auto",
  "firefox-kiosk",
  "chromium-app",
  "xdg-open",
  "custom",
] as const;

export const browserSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("auto") }),
  z.object({ kind: z.literal("firefox-kiosk") }),
  z.object({ kind: z.literal("chromium-app") }),
  z.object({ kind: z.literal("xdg-open") }),
  z.object({
    kind: z.literal("custom"),
    command: z.string().min(1),
    args: z.array(z.string()),
  }),
]);

export type BrowserSelection = z.infer<typeof browserSelectionSchema>;

export type BrowserKind = Exclude<BrowserSelection["kind"], "auto">;

/**
 * `managed` browsers are ours to kill on shutdown; `unmanaged` ones (xdg-open) hand
 * the URL to whatever is already running, so their exit tells us nothing.
 */
export type BrowserLaunch =
  | { readonly kind: "managed"; readonly process: ChildProcess }
  | { readonly kind: "unmanaged" };

export type BrowserProvider = {
  readonly kind: BrowserKind;
  /** For error messages only. */
  readonly command: string;
  readonly available: () => Promise<Availability>;
  readonly launch: (paths: Paths, url: string) => Promise<BrowserLaunch>;
};
