#!/usr/bin/env node
import { createProgram } from "./program";
import { handleError } from "./ui";

await createProgram().parseAsync(process.argv).catch(handleError);
