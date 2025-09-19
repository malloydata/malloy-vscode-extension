#!/usr/bin/env ts-node
import packageJson from '../package.json';

let malloyPackages = Object.keys(packageJson.dependencies).filter(name =>
  name.startsWith('@malloy')
);

const nonCorePackages = ['@malloydata/malloy-explorer'];
const args = process.argv.slice(2);

const corePackagesOnly = args.includes('--core-packages-only');
if (corePackagesOnly) {
  malloyPackages = malloyPackages.filter(name => !nonCorePackages.includes(name));
}

const versionArg = args.find(arg => !arg.startsWith('--'));
if (versionArg) {
  malloyPackages = malloyPackages.map(
    packageName => `${packageName}@${versionArg}`
  );
}

console.log(malloyPackages.join(' '));
