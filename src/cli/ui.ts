import pc from "picocolors";
import type { CommandNeeds } from "../server/result";

export const prefix = `${pc.bold(pc.yellow("desk"))}${pc.bold(pc.white("doodle"))}${pc.yellow(":")}`;

export const helpStyle = {
  styleTitle: (value: string): string => pc.bold(pc.white(value)),
  styleUsage: (value: string): string => pc.white(value),
  styleCommandText: (value: string): string => pc.white(value),
  styleSubcommandText: (value: string): string => pc.white(value),
  styleOptionText: (value: string): string => pc.white(value),
  styleArgumentText: (value: string): string => pc.white(value),
  styleDescriptionText: (value: string): string => value,
} as const;

const section = (value: string): string => `  ${pc.bold(pc.white(`${value}:`))}`;

const optionRow = (option: string, description: string): string =>
  `    ${pc.white(option.padEnd(24))} ${description}`;

export const rootHelpText = [
  "",
  section("Editor Shortcuts"),
  optionRow("Ctrl+S", "save and close"),
  optionRow("Esc", "close without saving"),
  "",
  section("Setup"),
  optionRow("deskdoodle check", "check providers and required tools"),
  "",
  section("Requirements"),
  `    ImageMagick and one supported wallpaper provider`,
].join("\n");

/** Phrases a provider's unmet requirements: "needs gsettings, gdbus" / "needs one of a, b". */
export const describeNeeds = (needs: CommandNeeds): string => {
  const commands = needs.commands.join(", ");
  return needs.kind === "any" ? `needs one of ${commands}` : `needs ${commands}`;
};

export const logInfo = (message: string): void => {
  console.log(`${prefix} ${message}`);
};

export const logSuccess = (message: string): void => {
  console.log(`${prefix} ${pc.green(message)}`);
};

export const logWarning = (message: string): void => {
  console.log(`${prefix} ${pc.yellow(message)}`);
};

export const logError = (message: string): void => {
  console.error(`${prefix} ${pc.red(message)}`);
};

export const writeCommanderError = (message: string, write: (value: string) => void): void => {
  write(`${prefix} ${pc.red(message.trim())}\n`);
};

export const handleError = (error: unknown): never => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
};

export const link = (url: string): string => pc.underline(url);
