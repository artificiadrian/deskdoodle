import pc from "picocolors";

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

const section = (value: string): string => {
  return `  ${pc.bold(pc.white(`${value}:`))}`;
};

const optionRow = (option: string, description: string): string => {
  return `    ${pc.white(option.padEnd(24))} ${description}`;
};

const textRow = (text: string): string => {
  return `    ${text}`;
};

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
  textRow("ImageMagick and one supported wallpaper provider"),
].join("\n");

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
  const message = error instanceof Error ? error.message : String(error);
  logError(message);
  process.exit(1);
};

export const link = (url: string): string => {
  return pc.underline(url);
};
