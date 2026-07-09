import { Argument, type Command } from "commander";
import pc from "picocolors";
import {
  getConfigPath,
  parseBackendSelectionName,
  parseBrowserSelectionName,
  readConfig,
  setConfigBackend,
  setConfigBrowser,
  writeConfig,
} from "../../server/config";
import {
  backendSelectionKinds,
  browserSelectionKinds,
  type BrowserSelection,
  type DeskDoodleConfig,
} from "../../shared/types";
import { handleError, logInfo, logSuccess } from "../ui";

export type ConfigCommandResult = {
  readonly message: string;
};

export const registerConfigCommands = (program: Command): void => {
  const config = program
    .command("config")
    .description("show or change saved choices");

  config
    .command("show")
    .usage("")
    .description("show saved choices")
    .action(() => {
      void showConfig().catch(handleError);
    });

  const configSet = config
    .command("set")
    .description("change a saved choice");

  configSet
    .command("backend")
    .usage("<backend>")
    .addArgument(new Argument("<backend>", "wallpaper provider").choices([...backendSelectionKinds]))
    .description("set wallpaper provider")
    .action((backend: string) => {
      void saveBackendConfig(backend).catch(handleError);
    });

  configSet
    .command("browser")
    .usage("<browser> [command] [args...]")
    .addArgument(
      new Argument("<browser>", "browser launcher").choices([...browserSelectionKinds]),
    )
    .argument("[command]", "custom browser command")
    .argument("[args...]", "custom browser arguments; use {url} for the editor URL")
    .allowUnknownOption(true)
    .description("set browser launcher")
    .action((browser: string, command: string | undefined, args: readonly string[]) => {
      void saveBrowserConfig(browser, command, args).catch(handleError);
    });
};

export const showConfigCommand = async (): Promise<ConfigCommandResult> => {
  const config = await readConfig();
  return {
    message: `config ${pc.underline(getConfigPath())}\n${formatConfig(config)}`,
  };
};

export const setBackendConfigCommand = async (
  backend: string,
): Promise<ConfigCommandResult> => {
  const config = await readConfig();
  const nextConfig = setConfigBackend(config, parseBackendSelectionName(backend));
  await writeConfig(nextConfig);
  return { message: `saved wallpaper provider ${pc.bold(nextConfig.backend.kind)}` };
};

export const setBrowserConfigCommand = async (
  browser: string,
  command: string | undefined,
  args: readonly string[],
): Promise<ConfigCommandResult> => {
  const config = await readConfig();
  const nextConfig = setConfigBrowser(
    config,
    parseBrowserSelectionName(browser, command, args),
  );
  await writeConfig(nextConfig);
  return { message: `saved browser launcher ${pc.bold(formatBrowserSelection(nextConfig.browser))}` };
};

const formatConfig = (config: DeskDoodleConfig): string => {
  return [
    optionRow("wallpaper provider", pc.bold(config.backend.kind)),
    optionRow("browser launcher", pc.bold(formatBrowserSelection(config.browser))),
  ].join("\n");
};

const formatBrowserSelection = (browser: BrowserSelection): string => {
  switch (browser.kind) {
    case "custom":
      return `custom ${browser.command} ${browser.args.join(" ")}`.trimEnd();
    default:
      return browser.kind;
  }
};

const showConfig = async (): Promise<void> => {
  const result = await showConfigCommand();
  logInfo(result.message);
};

const saveBackendConfig = async (backend: string): Promise<void> => {
  const result = await setBackendConfigCommand(backend);
  logSuccess(result.message);
};

const saveBrowserConfig = async (
  browser: string,
  command: string | undefined,
  args: readonly string[],
): Promise<void> => {
  const result = await setBrowserConfigCommand(browser, command, args);
  logSuccess(result.message);
};

const optionRow = (option: string, description: string): string => {
  return `  ${pc.white(option.padEnd(19))} ${description}`;
};
