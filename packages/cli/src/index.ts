#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { initCommand } from "./commands/init.js";
import { configCommand } from "./commands/config.js";
import { runCommand } from "./commands/run.js";
import { buildCommand } from "./commands/build.js";

const program = new Command();
program.name("dolphin")
  .description("Build Android applications with React, Vite and the Dolphin native runtime")
  .version("0.1.0");
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(runCommand);
program.addCommand(buildCommand);
program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(`Dolphin: ${message}`));
  process.exitCode = 1;
});
