#!/usr/bin/env node
import { createProgram } from "./commands";
import { handleError } from "./ui";

await createProgram().parseAsync(process.argv).catch(handleError);
