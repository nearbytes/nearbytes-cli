#!/usr/bin/env node
/**
 * Re-exec `entryScript` under Node from `.nvmrc` when fnm/nvm is available.
 * Call at the top of dev/bootstrap entry points before any other work.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reexecFlag = 'NB_NVMRC_REEXEC';

export function maybeReexecNvmrc(entryScript, extraArgs = []) {
  if (process.env[reexecFlag] === '1') return;
  if (!existsSync(resolve(root, '.nvmrc'))) return;

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
  if (r.status === 2) return;
  process.exit(r.status ?? 0);
}
