/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as yargs from 'yargs';
import {doBuild} from './build_common';
import {outDir, Targets} from './constants';

yargs
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
