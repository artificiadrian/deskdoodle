import pc from "picocolors";
import type { CommandNeeds } from "../server/result";

const wordmark = `${pc.bold(pc.yellow("desk"))}${pc.bold(pc.white("doodle"))}`;

/** The pen stroke is the status light: its colour, not a separate glyph, carries the level. */
const stroke = (paint: (value: string) => string): string => `${paint("∿")} ${wordmark} `;

export const helpStyle = {
  styleTitle: (value: string): string => pc.bold(pc.white(value)),
  styleUsage: (value: string): string => pc.white(value),
  styleCommandText: (value: string): string => pc.white(value),
  styleSubcommandText: (value: string): string => pc.white(value),
  styleOptionText: (value: string): string => pc.white(value),
  styleArgumentText: (value: string): string => pc.white(value),
  styleDescriptionText: (value: string): string => value,
} as const;

const taglineText = "deskdoodle — draw on your wallpaper";
const tagline = `${wordmark} ${pc.dim("— draw on your wallpaper")}`;

// Odd width so the stand's `┬` lands exactly on centre.
const screenWidth = 31;
const standOffset = (screenWidth - 1) / 2;
const stand = "═════╧═════";
const standCentre = 5;

const taglineIndent = 3;
/** Centres the monitor over the tagline beneath it. */
const frameIndent = taglineIndent + Math.round((taglineText.length - (screenWidth + 2)) / 2);
const standIndent = frameIndent + 1 + standOffset - standCentre;

/**
 * A small googly-eyed face, centred in the screen. Each row is exactly `screenWidth`
 * wide, so the frame's right edge stays put.
 */
const face = [
  " ".repeat(screenWidth),
  `${" ".repeat(14)}o O${" ".repeat(14)}`,
  `${" ".repeat(13)}╰───╯${" ".repeat(13)}`,
  " ".repeat(screenWidth),
];

/** Leftover marks from other pens. `blueBright` because dim blue all but vanishes on dark terminals. */
const strayInks = {
  red: pc.red,
  green: pc.green,
  blue: pc.blueBright,
  magenta: pc.magenta,
  cyan: pc.cyan,
} as const;

type StrayInk = keyof typeof strayInks;

/** Scratches, as `[row, column, mark, ink]`. Drawn dim, so they read as slips of the pen. */
const strayMarks = [
  [0, 2, "'", "red"],
  [0, 4, ".", "cyan"],
  [0, 26, ".", "green"],
  [1, 2, ",", "blue"],
  [1, 25, "~", "magenta"],
  [1, 27, "'", "green"],
  [2, 5, ".", "magenta"],
  [2, 26, "`", "red"],
  [3, 3, "~", "green"],
  [3, 12, ".", "blue"],
  [3, 21, ",", "cyan"],
  [3, 27, ".", "red"],
] as const satisfies readonly (readonly [number, number, string, StrayInk])[];

const screenRow = (row: number): string => {
  const cells = [...(face[row] ?? "")].map((char) =>
    char === " " ? " " : pc.bold(pc.yellow(char)),
  );

  for (const [markRow, column, mark, ink] of strayMarks) {
    if (markRow === row) {
      cells[column] = pc.dim(strayInks[ink](mark));
    }
  }

  return `${" ".repeat(frameIndent)}${pc.dim("│")}${cells.join("")}${pc.dim("│")}`;
};

export const banner = [
  `${" ".repeat(frameIndent)}${pc.dim(`┌${"─".repeat(screenWidth)}┐`)}`,
  ...face.map((_, row) => screenRow(row)),
  `${" ".repeat(frameIndent)}${pc.dim(`└${"─".repeat(standOffset)}┬${"─".repeat(standOffset)}┘`)}`,
  `${" ".repeat(standIndent)}${pc.dim(stand)}`,
  `${" ".repeat(taglineIndent)}${tagline}`,
].join("\n");

/** The art is decoration. It earns its space only when a human is watching. */
export const printBanner = (): void => {
  if (process.stdout.isTTY) {
    console.log(`\n${banner}\n`);
  }
};

const section = (value: string): string => pc.bold(pc.white(`${value}:`));

/** `padEnd(11)` puts descriptions in the same column commander uses for its own. */
const optionRow = (option: string, description: string): string =>
  `  ${pc.white(option.padEnd(11))} ${pc.dim(description)}`;

export const rootHelpText = [
  "",
  section("While drawing"),
  optionRow("Ctrl+S", "make it your desktop background"),
  optionRow("Esc", "close without saving"),
  "",
  pc.dim("Needs GNOME, ImageMagick, and a browser to draw in."),
  pc.dim("This is an experiment. Break it freely."),
].join("\n");

/** Phrases a provider's unmet requirements: "needs gsettings, gdbus" / "needs one of a, b". */
export const describeNeeds = (needs: CommandNeeds): string => {
  const commands = needs.commands.join(", ");
  return needs.kind === "any" ? `needs one of ${commands}` : `needs ${commands}`;
};

export const logInfo = (message: string): void => {
  console.log(`${stroke(pc.dim)} ${message}`);
};

export const logSuccess = (message: string): void => {
  console.log(`${stroke(pc.green)} ${pc.green(message)}`);
};

export const logWarning = (message: string): void => {
  console.log(`${stroke(pc.yellow)} ${pc.yellow(message)}`);
};

export const logError = (message: string): void => {
  console.error(`${stroke(pc.red)} ${pc.red(message)}`);
};

export const writeCommanderError = (message: string, write: (value: string) => void): void => {
  write(`${stroke(pc.red)} ${pc.red(message.trim())}\n`);
};

export const handleError = (error: unknown): never => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
};

export const link = (url: string): string => pc.underline(url);
