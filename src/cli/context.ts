/**
 * CLI session context — shared mutable state for immediate and REPL mode.
 *
 * The runtime/sync core (skeleton, file service, reactive-volume cache,
 * filesystem watchers, inbound-refresh) is NOT defined here anymore: it lives
 * in `nearbytes-engine` and is reused verbatim by the desktop app. This file
 * only adds the CLI-specific shell concerns on top — WebDAV, dev-inspect,
 * volume registry, terminal cwd. Timeline cursor state lives on
 * {@link EngineRuntime.timelineCursors} (nearbytes-engine).
 */
import type {
  FileService,
  ReactiveVolume,
  TimelineEvent,
} from 'nearbytes-files';
import type {
  NearbytesSkeleton,
  VolumeWatcher,
  NearbytesConfig,
} from 'nearbytes-skeleton';
import {
  assertTimelineWritesAllowed as assertTimelineWritesAllowedForSecret,
  createEngineRuntime,
  openAndWatch as engineOpenAndWatch,
  reloadVolumeFromDisk as engineReloadVolumeFromDisk,
  refreshIfOpen as engineRefreshIfOpen,
  attachSyncInboundRefresh as engineAttachSyncInboundRefresh,
  type EngineRuntime,
} from 'nearbytes-engine';
import type { WebDavServer } from '../webdav/index.js';
import type { DevInspectServer } from '../dev/index.js';
import type { ReplChatFeed } from './replChatFeed.js';
import { installSyncDebugBridge } from '../syncDebugBridge.js';
import { debugEnabled } from '../debug.js';
import {
  syncTimelineBeginSession,
  syncTimelineMarkSession,
} from 'nearbytes-sync/node';

/**
 * The CLI Context is an {@link EngineRuntime} (shared core) plus shell state.
 * Because it structurally satisfies `EngineRuntime`, it is passed directly to
 * the re-exported engine helpers below.
 */
export interface Context extends EngineRuntime {
  config: NearbytesConfig;
  readonly skeleton: NearbytesSkeleton;
  readonly fileService: FileService;
  readonly volumes: Map<string, ReactiveVolume>;
  readonly watchers: Map<string, VolumeWatcher>;
  readonly secretsByKey: Map<string, string>;
  lastTimelineEvents: TimelineEvent[] | null;

  webdav: WebDavServer | null;
  devInspect: DevInspectServer | null;
  activeVolume: ReactiveVolume | null;
  /** Registered volume name → channel secret (`volume-session.json`). */
  readonly volumeRegistry: Map<string, string>;
  volumeSessionActive: string | null;
  webdavAuthGeneration: number;
  webdavAuthenticatedGeneration: number | null;
  webdavLastAuthProfile: string | null;
  webdavLastAuthAt: number | null;
  webdavViewGeneration: number;
  remoteCwd: string;
  /** Live chat above the REPL prompt; null outside interactive REPL. */
  replChatFeed: ReplChatFeed | null;
  destroy(): Promise<void>;
}

export interface CreateContextOptions {
  readonly webdav?: boolean;
  readonly webdavPort?: number;
  readonly devInspectPort?: number;
}

export async function createContext(
  config: NearbytesConfig,
  options?: CreateContextOptions,
): Promise<Context> {
  installSyncDebugBridge();
  if (debugEnabled('timeline')) {
    syncTimelineBeginSession('repl-start');
  }
  const skeletonStart = Date.now();
  const rt = await createEngineRuntime(config);
  if (debugEnabled('timeline')) {
    syncTimelineMarkSession('skeleton-ready', `${Date.now() - skeletonStart}ms`);
  }

  const ctx: Context = {
    // shared runtime core (from nearbytes-engine)
    config: rt.config,
    skeleton: rt.skeleton,
    fileService: rt.fileService,
    chatService: rt.chatService,
    volumes: rt.volumes,
    watchers: rt.watchers,
    secretsByKey: rt.secretsByKey,
    lastTimelineEvents: rt.lastTimelineEvents,
    volumeRefreshHooks: rt.volumeRefreshHooks,
    timelineCursors: rt.timelineCursors,
    // CLI shell state
    webdav: null,
    devInspect: null,
    activeVolume: null,
    volumeRegistry: new Map<string, string>(),
    volumeSessionActive: null,
    webdavAuthGeneration: 0,
    webdavAuthenticatedGeneration: null,
    webdavLastAuthProfile: null,
    webdavLastAuthAt: null,
    webdavViewGeneration: 0,
    remoteCwd: '',
    replChatFeed: null,

    async destroy(): Promise<void> {
      if (ctx.devInspect !== null) await ctx.devInspect.close();
      if (ctx.webdav !== null) await ctx.webdav.close();
      await rt.destroy();
    },
  };

  if (options?.webdav === true) {
    const { startWebDavServer } = await import('../webdav/index.js');
    const { createWebDavAccess } = await import('../webdav/access.js');
    ctx.webdav = await startWebDavServer({
      fileService: ctx.fileService,
      access: createWebDavAccess(ctx),
      port: options.webdavPort,
    });
  }

  if (options?.devInspectPort !== undefined) {
    const { startDevInspectServer } = await import('../dev/index.js');
    const { createReplCommandRunner } = await import('./replExec.js');
    ctx.devInspect = await startDevInspectServer({
      dataDir: config.dataDir,
      fileService: ctx.fileService,
      port: options.devInspectPort,
      runCommand: createReplCommandRunner(ctx),
    });
  }

  return ctx;
}

export function activeVolumeSecret(ctx: Context): string | undefined {
  if (ctx.volumeSessionActive === null) return undefined;
  return ctx.volumeRegistry.get(ctx.volumeSessionActive);
}

export function assertTimelineWritesAllowed(ctx: Context): void {
  const secret = activeVolumeSecret(ctx);
  if (secret === undefined) return;
  assertTimelineWritesAllowedForSecret(ctx.timelineCursors, secret);
}

// Re-export the shared engine runtime helpers under their historical names so
// the rest of the CLI keeps importing them from './context.js' unchanged.
// `Context extends EngineRuntime`, so passing a `ctx` satisfies these.
export const reloadVolumeFromDisk = engineReloadVolumeFromDisk;
export const openAndWatch = engineOpenAndWatch;
export const refreshIfOpen = engineRefreshIfOpen;
export const attachSyncInboundRefresh = engineAttachSyncInboundRefresh;
