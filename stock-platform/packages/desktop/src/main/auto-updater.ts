/**
 * Electron auto-updater wiring.
 *
 * Uses electron-updater's `NsisUpdater` with a generic HTTP provider so the
 * update feed URL is whatever the operator put in `userData/.env`
 * (`UPDATE_FEED_URL`). That keeps the installer identical across customers —
 * only the runtime config changes.
 *
 * Events are forwarded to the renderer via `updater:event` so the UI can show
 * "update available", "downloading", "ready to install" banners.
 */

import { app, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
import { getUpdateFeedUrl } from './runtime-config.js';

const { NsisUpdater } = pkg;
type NsisUpdaterInstance = InstanceType<typeof NsisUpdater>;

let updater: NsisUpdaterInstance | null = null;
let getWindow: (() => BrowserWindow | null) | null = null;

function emit(event: string, payload?: unknown): void {
  try {
    const win = getWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:event', { event, payload });
    }
  } catch { /* renderer not ready */ }
}

export function initAutoUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter;
  const feed = getUpdateFeedUrl();
  if (!feed) throw new Error('UPDATE_FEED_URL is empty');

  updater = new NsisUpdater({ provider: 'generic', url: feed });
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = {
    info: (msg: unknown) => console.log('[UPDATER]', msg),
    warn: (msg: unknown) => console.warn('[UPDATER]', msg),
    error: (msg: unknown) => console.error('[UPDATER]', msg),
    debug: () => { /* noop */ },
  } as unknown as typeof updater.logger;

  updater.on('checking-for-update', () => emit('checking'));
  updater.on('update-available', (info) => emit('available', { version: info.version }));
  updater.on('update-not-available', () => emit('not-available', { current: app.getVersion() }));
  updater.on('download-progress', (p) => emit('progress', { percent: p.percent, bytesPerSecond: p.bytesPerSecond }));
  updater.on('update-downloaded', (info) => emit('downloaded', { version: info.version }));
  updater.on('error', (err) => emit('error', { message: (err as Error).message }));

  updater.checkForUpdates().catch((err) => {
    console.error('[UPDATER] Initial check failed:', (err as Error).message);
  });

  setInterval(() => {
    updater?.checkForUpdates().catch((err) => {
      console.error('[UPDATER] Periodic check failed:', (err as Error).message);
    });
  }, 6 * 60 * 60 * 1000);
}

export async function checkForUpdatesNow(): Promise<{ checked: boolean; reason?: string }> {
  if (!updater) return { checked: false, reason: 'updater not initialized (UPDATE_FEED_URL empty or dev mode)' };
  try {
    const result = await updater.checkForUpdates();
    return { checked: true, reason: result ? `version ${result.updateInfo.version}` : 'no update info' };
  } catch (err) {
    return { checked: false, reason: (err as Error).message };
  }
}

export function quitAndInstall(): void {
  if (!updater) return;
  updater.quitAndInstall(false, true);
}
