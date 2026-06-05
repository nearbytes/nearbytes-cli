#!/usr/bin/env node
/**
 * Build and run the CLI under the current Node binary (after .nvmrc re-exec).
 * Keeps `yarn dev` / `yarn repl` on Node 22 even when the shell default is older.
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeReexecNvmrc } from './maybe-reexec-nvmrc.mjs';

const entry = fileURLToPath(import.meta.url);
const root = resolve(dirname(entry), '..');
const cliArgs = process.argv.slice(2);

maybeReexecNvmrc(entry, cliArgs);

function run(nodeArgs) {
  const r = spawnSync(process.execPath, nodeArgs, { cwd: root, stdio: 'inherit', env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run([resolve(root, 'scripts/ensure-engines.mjs')]);
run([resolve(root, 'node_modules/typescript/bin/tsc')]);
run([resolve(root, 'dist/cli/index.js'), ...cliArgs]);
