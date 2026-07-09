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

// Odd width so the stand's `┬` lands exactly on centre.
const screenWidth = 31;
const standOffset = (screenWidth - 1) / 2;
const stand = "═════╧═════";
const standCentre = 5;

const frameIndent = 3;
const standIndent = frameIndent + 1 + standOffset - standCentre;

const brand = "deskdoodle";
const slogan = "draw on your wallpaper";

const brandRow = 1;
const brandStart = Math.floor((screenWidth - brand.length) / 2);
const sloganStart = Math.floor((screenWidth - slogan.length) / 2);

const centred = (text: string, start: number): string =>
  `${" ".repeat(start)}${text}${" ".repeat(screenWidth - start - text.length)}`;

/**
 * What the little monitor is showing. Each row is exactly `screenWidth` wide, so the
 * frame's right edge stays put.
 */
const content = [
  " ".repeat(screenWidth),
  centred(brand, brandStart),
  centred(slogan, sloganStart),
  " ".repeat(screenWidth),
];

/** `desk` yellow and `doodle` white, matching the log prefix's wordmark. */
const inkFor = (row: number, column: number, char: string): string => {
  if (char === " ") {
    return " ";
  }
  if (row === brandRow) {
    return column < brandStart + 4 ? pc.bold(pc.yellow(char)) : pc.bold(pc.white(char));
  }
  return pc.dim(char);
};

/** Leftover marks from other pens. `blueBright` because dim blue all but vanishes on dark terminals. */
const strayInks = {
  red: pc.red,
  green: pc.green,
  blue: pc.blueBright,
  magenta: pc.magenta,
  cyan: pc.cyan,
} as const;

type StrayInk = keyof typeof strayInks;

/**
 * Scratches, as `[row, column, mark, ink]`. Drawn dim, so they read as slips of the pen.
 * Columns are chosen to fall clear of the two text rows; `screenRow` asserts as much.
 */
const strayMarks = [
  [0, 1, "*", "red"],
  [0, 2, "'", "magenta"],
  [0, 6, "°", "cyan"],
  [0, 11, ".", "green"],
  [0, 19, "~", "blue"],
  [0, 24, "+", "red"],
  [0, 28, ".", "cyan"],
  [0, 30, "'", "green"],
  [1, 0, ",", "green"],
  [1, 3, "·", "blue"],
  [1, 7, "/", "red"],
  [1, 22, "~", "cyan"],
  [1, 26, "*", "magenta"],
  [1, 29, ".", "blue"],
  [2, 0, "`", "magenta"],
  [2, 2, "\\", "cyan"],
  [2, 27, "+", "green"],
  [2, 30, "x", "blue"],
  [3, 1, "~", "green"],
  [3, 6, "°", "red"],
  [3, 7, ".", "blue"],
  [3, 12, ":", "cyan"],
  [3, 16, ",", "magenta"],
  [3, 23, "*", "red"],
  [3, 28, "'", "green"],
  [3, 30, "-", "cyan"],
] as const satisfies readonly (readonly [number, number, string, StrayInk])[];

const screenRow = (row: number): string => {
  const plain = content[row] ?? "";
  const cells = [...plain].map((char, column) => inkFor(row, column, char));

  for (const [markRow, column, mark, ink] of strayMarks) {
    if (markRow !== row) {
      continue;
    }
    if (plain[column] !== " ") {
      throw new Error(`Stray mark at ${row},${column} would cover the banner text.`);
    }
    cells[column] = pc.dim(strayInks[ink](mark));
  }

  return `${" ".repeat(frameIndent)}${pc.dim("│")}${cells.join("")}${pc.dim("│")}`;
};

export const banner = [
  `${" ".repeat(frameIndent)}${pc.dim(`┌${"─".repeat(screenWidth)}┐`)}`,
  ...content.map((_, row) => screenRow(row)),
  `${" ".repeat(frameIndent)}${pc.dim(`└${"─".repeat(standOffset)}┬${"─".repeat(standOffset)}┘`)}`,
  `${" ".repeat(standIndent)}${pc.dim(stand)}`,
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
