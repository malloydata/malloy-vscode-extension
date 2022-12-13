/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/* eslint-disable no-console */
import yargs from "yargs";
import { doBuild, outDir, Target } from "./build_common";

yargs
  .scriptName("build-extension")
  .usage("$0 <cmd> [args]")
  .command(
    "build [target]",
    "Build extension",
    {
      development: {
        alias: "D",
        type: "boolean",
        default: false,
        describe: "Build in development mode",
      },
      target: {
        type: "string",
        default: undefined,
        describe: "Target platform",
      },
    },
    ({ development, target }) => {
      console.log(
        `Building extension to ${outDir} in ${
          development ? "development" : "production"
        } mode`
      );

      doBuild(development, target as Target | undefined)
        .then(() => {
          console.log("Extension built successfully");
        })
        .catch((error) => {
          console.error("Extension built with errors");
          console.log(error);
          process.exit(1);
        });
    }
  )
  .demandCommand(1)
  .recommendCommands()
  .strict()
  .help().argv;
