/**
 * Run yarn/node via the active Node toolchain (never the distro corepack on PATH).
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function nodeBinDir() {
  return dirname(process.execPath);
}

export function corepackBin() {
  return resolve(nodeBinDir(), 'corepack');
}

function spawnOk(argv, { cwd, env = process.env }) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Run a project script with the same Node binary as this process. */
export function runNode(cwd, nodeArgs, env = process.env) {
  spawnOk([process.execPath, ...nodeArgs], { cwd, env });
}

/** Run Yarn via corepack next to `process.execPath` (no global `corepack enable`). */
export function runYarn(cwd, yarnArgs, env = process.env) {
  const corepack = corepackBin();
  if (existsSync(corepack)) {
    spawnOk([corepack, 'yarn', ...yarnArgs], { cwd, env });
    return;
  }
  spawnOk(['yarn', ...yarnArgs], { cwd, env });
}
