import { publishChatMessage, readChatTimeline } from 'nearbytes-chat';
import { green, yellow, dim, bold, cyan } from './output.js';
import type { Context } from './context.js';

function resolveHubSecret(ctx: Context, override?: string): string {
  if (override !== undefined && override.trim().length > 0) {
    return override;
  }
  if (ctx.activeVolume !== null) {
    return ctx.activeVolume.volume.secret as string;
  }
  if (ctx.volumeSessionActive !== null) {
    const secret = ctx.volumeRegistry.get(ctx.volumeSessionActive);
    if (secret !== undefined) {
      return secret;
    }
  }
  throw new Error('No active hub — use `volume use <name>` or pass -s <secret>');
}

export async function cmdSay(
  ctx: Context,
  body: string,
  secretOverride?: string,
): Promise<void> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new Error('Usage: say <message> [-s <hub-secret>]');
  }
  const secret = resolveHubSecret(ctx, secretOverride);
  const published = await publishChatMessage(
    { log: ctx.skeleton.log, crypto: ctx.skeleton.crypto },
    secret,
    trimmed,
  );
  console.log(green('✓ Message sent'));
  console.log(`  Hub:   ${cyan(published.channelPublicKey)}`);
  console.log(`  Event: ${published.eventHash}`);
  console.log('');
  await cmdChat(ctx, secret, 12);
}

export async function cmdChat(
  ctx: Context,
  secretOverride?: string,
  limit = 30,
): Promise<void> {
  const secret = resolveHubSecret(ctx, secretOverride);
  const timeline = await readChatTimeline(
    { log: ctx.skeleton.log, crypto: ctx.skeleton.crypto },
    secret,
  );
  if (timeline.length === 0) {
    console.log(yellow('  (no chat messages in this hub yet)'));
    return;
  }
  const shown = timeline.slice(Math.max(0, timeline.length - Math.max(1, limit)));
  console.log(bold(`Chat — ${shown.length}/${timeline.length} message(s)`));
  for (const item of shown) {
    const when = new Date(item.publishedAt).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const verified = item.verified ? '' : dim(' !unverified');
    console.log(
      `${dim(when.padEnd(18))} ${item.eventHash.slice(0, 10)} ${item.message.body}${verified}`,
    );
  }
}
