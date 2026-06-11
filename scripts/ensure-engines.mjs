#!/usr/bin/env node
/**
 * Enforce package.json `engines` and verify `node:sqlite` on the shell runtime.
 * The CLI runs directly on Node (not Electron); nearbytes-log projection
 * persistence needs Node >= 22.5 (>= 22.13 recommended; 22.5–22.12 need
 * --experimental-sqlite, applied automatically).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeReexecNvmrc } from './maybe-reexec-nvmrc.mjs';
import {
  versionGte,
  needsExperimentalSqlite,
  maybeReexecForSqliteFlag,
} from './node-sqlite-runtime.mjs';

const entry = fileURLToPath(import.meta.url);
maybeReexecNvmrc(entry);
maybeReexecForSqliteFlag(entry);

const pkg = JSON.parse(readFileSync(resolve(dirname(entry), '..', 'package.json'), 'utf8'));

function parseMinVersion(range) {
  if (typeof range !== 'string') return null;
  const m = />=?\s*([\d.]+)/.exec(range);
  return m?.[1] ?? null;
}

const minNode = parseMinVersion(pkg.engines?.node);
if (minNode && !versionGte(process.versions.node, minNode)) {
  console.error(
    `[engines] Node ${process.versions.node} is too old; need >= ${minNode} ` +
      `(see package.json engines.node).\n` +
      `  Tip: yarn dev auto-installs Node from .nvmrc under .local/toolchain, or use fnm/nvm.`,
  );
  process.exit(1);
}

try {
  await import('node:sqlite');
  const flagNote = needsExperimentalSqlite() ? ' (via --experimental-sqlite)' : '';
  console.log(
    `[engines] ok — node ${process.versions.node} (>= ${minNode ?? '?'}, node:sqlite${flagNote})`,
  );
} catch (err) {
  const hint =
    needsExperimentalSqlite(process.versions.node) ?
      '  Node 22.5–22.12 needs --experimental-sqlite; upgrade to Node >= 22.13 (nvm install 22.13).'
    : '  Fix: yarn dev (auto-installs Node from .nvmrc), fnm/nvm, or install Node 22.13+.';
  console.error(
    `[engines] Node ${process.versions.node} cannot load node:sqlite.\n` +
      `  nearbytes-log projection persistence needs Node >= 22.5.\n` +
      hint,
  );
  if (err instanceof Error && err.message) {
    console.error(`  (${err.message})`);
  }
  process.exit(1);
}
