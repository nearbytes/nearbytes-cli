/**
 * Live hub chat above the readline prompt — incoming messages scroll in
 * without disturbing the line being edited (same technique as IRC clients).
 *
 * Detection is push-driven via {@link attachChatPush} on the shared engine
 * runtime (sync events + volume filesystem refresh hooks). No timeline polling.
 */

import * as readline from 'readline';
import type { ChatTimelineItem } from 'nearbytes-chat';
import { attachChatPush } from 'nearbytes-engine';
import type { Context } from './context.js';
import { resolveHubSecret } from './chatCommands.js';
import { bold, cyan, dim, yellow } from './output.js';

const HUB_WATCH_MS = 2_000;

export interface ReplChatFeed {
  /** Mark an event seen and paint it above the prompt (local `say`). */
  notify(item: ChatTimelineItem): void;
  stop(): void;
}

function activeHubSecretOrNull(ctx: Context): string | null {
  try {
    return resolveHubSecret(ctx);
  } catch {
    return null;
  }
}

function fmtTimeShort(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function wrapBody(body: string, indent: string, width: number): string[] {
  const max = Math.max(24, width - indent.length);
  const lines: string[] = [];
  for (const raw of body.split('\n')) {
    let rest = raw;
    while (rest.length > max) {
      let breakAt = rest.lastIndexOf(' ', max);
      if (breakAt < max * 0.4) {
        breakAt = max;
      }
      lines.push(indent + rest.slice(0, breakAt).trimEnd());
      rest = rest.slice(breakAt).trimStart();
    }
    lines.push(indent + rest);
  }
  return lines;
}

function formatChatBubble(
  item: ChatTimelineItem,
  opts: { selfKeyHex: string; cols: number },
): string[] {
  const senderPk = item.message.k.toLowerCase();
  const isSelf = senderPk === opts.selfKeyHex;
  const sender = isSelf ? bold(cyan('you')) : cyan(senderPk.slice(0, 8));
  const time = dim(fmtTimeShort(item.publishedAt));
  const flag = item.verified ? '' : dim(' · ') + yellow('unverified');
  const head = `  ${dim('◦')} ${sender}${dim(' · ')}${time}${flag}`;
  const bodyLines = wrapBody(item.message.body, '    ', opts.cols);
  return [head, ...bodyLines, ''];
}

/** Print lines above the current input without leaving prompt debris. */
export function printReplAbovePrompt(rl: readline.Interface, lines: readonly string[]): void {
  if (lines.length === 0) {
    return;
  }
  if (process.stdout.isTTY !== true) {
    for (const line of lines) {
      console.log(line);
    }
    return;
  }
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
  rl.prompt(true);
}

export function attachReplChatFeed(ctx: Context, rl: readline.Interface): ReplChatFeed {
  let stopped = false;
  let trackedSecret: string | null = null;
  let selfKeyHex = '';
  let hubWatchTimer: ReturnType<typeof setInterval> | null = null;

  const paint = (item: ChatTimelineItem): void => {
    if (stopped) {
      return;
    }
    const profilePk = ctx.skeleton.sync.activeProfilePublicKey;
    selfKeyHex = profilePk !== '' ? profilePk.toLowerCase() : selfKeyHex;
    const cols = process.stdout.columns ?? 80;
    printReplAbovePrompt(rl, formatChatBubble(item, { selfKeyHex, cols }));
  };

  const push = attachChatPush(ctx, (item) => {
    paint(item);
  });

  const reseedIfHubChanged = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    const secret = activeHubSecretOrNull(ctx);
    if (secret === null) {
      trackedSecret = null;
      return;
    }
    if (secret === trackedSecret) {
      return;
    }
    trackedSecret = secret;
    const profilePk = ctx.skeleton.sync.activeProfilePublicKey;
    selfKeyHex = profilePk !== '' ? profilePk.toLowerCase() : '';

    const { priorCount } = await push.seed(secret);
    const hubLabel =
      ctx.volumeSessionActive ??
      ctx.activeVolume?.volume.secret.toString().split(':')[0] ??
      'hub';
    printReplAbovePrompt(rl, [
      dim(`  ── chat live · ${hubLabel} (${priorCount} prior message(s) hidden) ──`),
      '',
    ]);
  };

  void reseedIfHubChanged();

  hubWatchTimer = setInterval(() => {
    void reseedIfHubChanged();
  }, HUB_WATCH_MS);
  hubWatchTimer.unref();

  return {
    notify(item: ChatTimelineItem): void {
      const secret = trackedSecret ?? activeHubSecretOrNull(ctx);
      if (secret === null) {
        paint(item);
        return;
      }
      push.notify(item, secret);
    },
    stop(): void {
      if (stopped) {
        return;
      }
      stopped = true;
      push.stop();
      if (hubWatchTimer !== null) {
        clearInterval(hubWatchTimer);
        hubWatchTimer = null;
      }
    },
  };
}
