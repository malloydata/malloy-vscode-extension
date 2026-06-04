/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import yargs from 'yargs';
import {doBuild} from './build_common';
import {outDir, Targets} from './constants';

void yargs
  .scriptName('build-extension')
  .usage('$0 <cmd> [args]')
  .command(
    'build [target]',
    'Build extension',
    {
      development: {
        alias: 'D',
        type: 'boolean',
        default: false,
        describe: 'Build in development mode',
      },
      metadata: {
        alias: 'm',
        type: 'boolean',
        default: false,
        describe: 'Output build metadata',
      },
      target: {
        choices: Targets,
        default: undefined,
        describe: 'Target platform',
      },
    },
    ({development, target, metadata}) => {
      console.log(
        `Building extension to ${outDir} in ${
          development ? 'development' : 'production'
        } mode`
      );

      doBuild(development, target, metadata)
        .then(() => {
          console.log('Extension built successfully');
          if (!development) {
            process.exit(0);
          }
        })
        .catch(error => {
          console.error('Extension built with errors');
          console.log(error);
          process.exit(1);
        });
    }
  )
  .demandCommand(1)
  .recommendCommands()
  .strict()
  .help().argv;
