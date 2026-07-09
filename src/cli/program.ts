import { Command } from "commander";
import { registerCheckCommand } from "./commands/check";
import { registerConfigCommands } from "./commands/config";
import { registerEditorCommands } from "./commands/editor";
import { helpStyle, rootHelpText, writeCommanderError } from "./ui";

export const createProgram = (): Command => {
  const program = new Command()
    .name("deskdoodle")
    .usage("[command]")
    .description("Draw on your wallpaper, then save it as the desktop background.")
    .helpOption("-h, --help", "show help")
    .showHelpAfterError()
    .configureHelp(helpStyle)
    .addHelpText("after", rootHelpText)
    .configureOutput({
      outputError: writeCommanderError,
    });

  registerEditorCommands(program);
  registerCheckCommand(program);
  registerConfigCommands(program);

  return program;
};
