#!/usr/bin/env node
/**
 * Re-exec `entryScript` under Node from `.nvmrc` when needed.
 * Order: keep current Node if sufficient → fnm/nvm → `.local/toolchain` download.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionGte } from './node-sqlite-runtime.mjs';
import {
  ensureLocalNodeBin,
  pathWithNodeBin,
  readNvmrcVersion,
} from './local-node.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reexecFlag = 'NB_NVMRC_REEXEC';

export function maybeReexecNvmrc(entryScript, extraArgs = []) {
  if (process.env[reexecFlag] === '1') return;
  if (!existsSync(resolve(root, '.nvmrc'))) return;

  const wanted = readNvmrcVersion(root);
  if (versionGte(process.versions.node, wanted)) return;

  const script = `
set -e
cd ${JSON.stringify(root)}
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use
else
  exit 2
fi
export ${reexecFlag}=1
exec node ${JSON.stringify(entryScript)} ${extraArgs.map((a) => JSON.stringify(a)).join(' ')}
`;

  // Use a non-login shell here. Login shells run ~/.bash_logout on exit; on
  // some headless/detached sessions that can turn our sentinel `exit 2`
  // ("no fnm/nvm available, keep current Node") into a generic status 1.
  const r = spawnSync('bash', ['-c', script], { cwd: root, stdio: 'inherit', env: process.env });
  if (r.status === 2) {
    const bin = ensureLocalNodeBin(root, wanted);
    const env = pathWithNodeBin(bin, { ...process.env, [reexecFlag]: '1' });
    const r2 = spawnSync(bin, [entryScript, ...extraArgs], {
      cwd: root,
      stdio: 'inherit',
      env,
    });
    process.exit(r2.status ?? 0);
  }
  process.exit(r.status ?? 0);
}
