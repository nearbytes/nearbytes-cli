#!/usr/bin/env node
/**
 * Dev entry bootstrap: install deps, optional update, refresh nearbytes-* to main.
 * Wired from `yarn dev` in consumer repos.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeReexecNvmrc } from './maybe-reexec-nvmrc.mjs';
import { pathWithNodeBin } from './local-node.mjs';
import { runNode, runYarn } from './toolchain.mjs';

const entry = fileURLToPath(import.meta.url);
maybeReexecNvmrc(entry);

const root = resolve(dirname(entry), '..');
const env = pathWithNodeBin(process.execPath, process.env);

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

console.log('[dev] yarn install');
runYarn(root, ['install'], env);

console.log('[dev] ensure engines');
runNode(root, ['scripts/ensure-engines.mjs'], env);

if (pkg.scripts?.update) {
  console.log('[dev] yarn update');
  runYarn(root, ['update'], env);
}

if (pkg.scripts?.refresh) {
  console.log('[dev] yarn refresh');
  runYarn(root, ['refresh'], env);
}

console.log('[dev] bootstrap done.');
