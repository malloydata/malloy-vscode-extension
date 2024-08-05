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

import fs from 'fs';
import {build, BuildOptions, context, Plugin} from 'esbuild';
import * as path from 'path';
import {execSync} from 'child_process';
import svgrPlugin from 'esbuild-plugin-svgr';
import {outDir} from './constants';

import {generateDisclaimer} from './license_disclaimer';

const litCssImporter: Plugin = {
  name: 'litCssImporter',
  setup(build) {
    build.onLoad({filter: /\.css$/}, async args => {
      const css = await fs.promises.readFile(args.path, 'utf-8');
      return {
        contents: /* javascript */ `
const css = require('lit').css;
module.exports = {
  styles: css\`${css}\`
};
`,
      };
    });
  },
};

const DEFINITIONS: Record<string, string> = {
  'process.env.NODE_DEBUG': 'false', // TODO this is a hack because some package we include assumed process.env exists :(
};

// const ENV_PASSTHROUGH = ['GA_API_SECRET', 'GA_MEASUREMENT_ID'];

// for (const variable of ENV_PASSTHROUGH) {
//   DEFINITIONS[`process.env.${variable}`] = JSON.stringify(
//     process.env[variable] || ''
//   );
// }

// building without a target does a default build
export async function doBuild(
  development: boolean,
  metadata = false
): Promise<void> {
  development = development || process.env['NODE_ENV'] === 'development';

  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});

  const fullLicenseFilePath = path.join(
    __dirname,
    '..',
    outDir,
    'third_party_notices.txt'
  );

  if (fs.existsSync(fullLicenseFilePath)) {
    fs.rmSync(fullLicenseFilePath);
  }
  if (!development) {
    generateDisclaimer(
      path.join(__dirname, '..', 'package.json'),
      path.join(__dirname, '..', 'node_modules'),
      fullLicenseFilePath
    );
  } else {
    fs.writeFileSync(fullLicenseFilePath, 'LICENSES GO HERE\n');
  }

  try {
    fs.writeFileSync(
      path.join(outDir, 'build-sha'),
      execSync('git rev-parse HEAD')
    );
  } catch {
    console.log('Skipping git SHA');
  }

  const baseOptions: BuildOptions = {
    bundle: true,
    minify: !development,
    sourcemap: development ? 'inline' : false,
    outdir: outDir,
    metafile: metadata,
    logLevel: 'info',
    target: 'node12.22',
    define: DEFINITIONS,
  };

  const buildOptions: Record<string, BuildOptions> = {};
  let nodeWebviewPlugins: Plugin[] = [];

  if (development) {
    console.log('Entering watch mode');
  }

  // build the extension and servers
  const commonNodeOptions: BuildOptions = {
    ...baseOptions,
    entryNames: '[name]',
    platform: 'node',
    define: DEFINITIONS,
  };

  buildOptions['node'] = {
    ...commonNodeOptions,
    entryPoints: ['./src/extension/node/extension_node.ts'],
    external: ['vscode', 'pg-native'],
  };

  buildOptions['nodeServer'] = {
    ...commonNodeOptions,
    entryPoints: ['./src/server/node/server_node.ts'],
    external: ['pg-native', '@duckdb/duckdb-wasm'],
  };

  nodeWebviewPlugins = [];

  const webviewPlugins = [
    svgrPlugin({
      typescript: true,
    }),
    litCssImporter,
    ...nodeWebviewPlugins,
  ];

  // build the webviews
  buildOptions['webview'] = {
    ...baseOptions,
    entryPoints: [
      './src/extension/webviews/query_page/entry.ts',
      './src/extension/webviews/connections_page/entry.ts',
      './src/extension/webviews/help_page/entry.ts',
    ],
    entryNames: '[dir]',
    platform: 'browser',
    plugins: webviewPlugins,
  };

  // Build the notebook renderers
  buildOptions['renderers'] = {
    ...baseOptions,
    format: 'esm',
    entryPoints: [
      './src/extension/notebook/renderer/malloy_entry.ts',
      './src/extension/notebook/renderer/schema_entry.ts',
    ],
    entryNames: '[name]',
    platform: 'browser',
    plugins: webviewPlugins,
  };

  const browserPlugins: Plugin[] = [];

  // build the web extension
  const commonBrowserOptions: BuildOptions = {
    ...baseOptions,
    entryNames: '[name]',
    format: 'cjs',
    platform: 'browser',
    tsconfig: './tsconfig.browser.json',
    plugins: browserPlugins,
    banner: {
      js: 'globalThis.require = globalThis.require || null;\nglobalThis.module = globalThis.module || {};',
    },
  };

  buildOptions['browser'] = {
    ...commonBrowserOptions,
    entryPoints: ['./src/extension/browser/extension_browser.ts'],
    external: ['vscode'],
  };

  buildOptions['browserServer'] = {
    ...commonBrowserOptions,
    entryPoints: ['./src/server/browser/server_browser.ts'],
  };

  if (development) {
    console.log('[watch] build started');
    for (const name in buildOptions) {
      const result = await context(buildOptions[name]);
      await result.watch();
    }
  } else {
    for (const name in buildOptions) {
      console.log(`\nBuilding ${name}`);
      const result = await build(buildOptions[name]);
      if (metadata) {
        fs.writeFileSync(`meta-${name}.json`, JSON.stringify(result.metafile));
      }
    }
  }
}
