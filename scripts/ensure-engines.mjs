#!/usr/bin/env node
/**
 * Enforce package.json `engines` and verify `node:sqlite` on the shell runtime.
 * The CLI runs directly on Node (not Electron); nearbytes-log projection
 * persistence needs Node >= 22.5.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeReexecNvmrc } from './maybe-reexec-nvmrc.mjs';

const entry = fileURLToPath(import.meta.url);
maybeReexecNvmrc(entry);

const pkg = JSON.parse(readFileSync(resolve(dirname(entry), '..', 'package.json'), 'utf8'));

function parseMinVersion(range) {
  if (typeof range !== 'string') return null;
  const m = />=?\s*([\d.]+)/.exec(range);
  return m?.[1] ?? null;
}

function versionGte(actual, required) {
  const a = actual.split('.').map((n) => Number(n));
  const r = required.split('.').map((n) => Number(n));
  for (let i = 0; i < Math.max(a.length, r.length); i++) {
    const av = a[i] ?? 0;
    const rv = r[i] ?? 0;
    if (av > rv) return true;
    if (av < rv) return false;
  }
  return true;
}

const minNode = parseMinVersion(pkg.engines?.node);
if (minNode && !versionGte(process.versions.node, minNode)) {
  console.error(
    `[engines] Node ${process.versions.node} is too old; need >= ${minNode} ` +
      `(see package.json engines.node).\n` +
      `  Tip: nvm use / fnm use (see .nvmrc) or install Node ${minNode}+.`,
  );
  process.exit(1);
}

try {
  await import('node:sqlite');
  console.log(
    `[engines] ok — node ${process.versions.node} (>= ${minNode ?? '?'}, node:sqlite available)`,
  );
} catch {
  console.error(
    `[engines] Node ${process.versions.node} lacks built-in node:sqlite.\n` +
      `  nearbytes-log projection persistence needs Node >= 22.5.\n` +
      `  Fix: nvm use / fnm use (see .nvmrc), or install Node 22+.`,
  );
  process.exit(1);
}
