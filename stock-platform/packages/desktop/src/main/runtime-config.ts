/**
 * Runtime configuration loader.
 *
 * Reads a `.env` file from Electron's userData folder so that operators can
 * edit the backend URL (and other settings) AFTER the app is installed,
 * without rebuilding. On first run the file is created from a default
 * template. Values are resolved lazily via getters so `reload()` takes
 * effect immediately across the app.
 */

import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type ConfigMap = Record<string, string>;

const DEFAULT_TEMPLATE = [
  '# Stock Platform — runtime configuration',
  '# Edit this file to point the desktop app at your deployed backend.',
  '# Changes take effect the next time the app starts (or use "Recharger" in the UI).',
  '',
  '# Backend sync server URL — e.g. https://stock-api.mycompany.com',
  'SYNC_SERVER_URL=http://localhost:3001',
  '',
  '# API key issued by the backend for this device',
  'SYNC_API_KEY=',
  '',
  '# Auto-update feed URL (leave empty to disable auto-update)',
  'UPDATE_FEED_URL=https://github.com/MouadElbou/hamdi/releases/latest/download',
  '',
].join('\n');

let cache: ConfigMap = {};
let configFilePath: string | null = null;

function parseEnv(content: string): ConfigMap {
  const out: ConfigMap = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function resolvePath(): string {
  if (configFilePath) return configFilePath;
  configFilePath = join(app.getPath('userData'), '.env');
  return configFilePath;
}

/** Load (or create on first run) the runtime .env file. */
export function loadRuntimeConfig(): ConfigMap {
  const path = resolvePath();
  if (!existsSync(path)) {
    try {
      writeFileSync(path, DEFAULT_TEMPLATE, 'utf-8');
      console.log('[CONFIG] Created default .env at', path);
    } catch (err) {
      console.error('[CONFIG] Could not create default .env:', (err as Error).message);
    }
  }
  try {
    const content = readFileSync(path, 'utf-8');
    cache = parseEnv(content);
    console.log('[CONFIG] Loaded .env from', path);
  } catch (err) {
    console.error('[CONFIG] Could not read .env:', (err as Error).message);
    cache = {};
  }
  // Also merge process.env so CI / dev overrides still win (useful during `npm run dev`)
  for (const key of ['SYNC_SERVER_URL', 'SYNC_API_KEY', 'UPDATE_FEED_URL']) {
    const fromProcess = process.env[key];
    if (fromProcess !== undefined && fromProcess !== '') cache[key] = fromProcess;
  }
  return { ...cache };
}

/** Re-read the .env file from disk (used by "Recharger" button). */
export function reloadRuntimeConfig(): ConfigMap {
  cache = {};
  return loadRuntimeConfig();
}

export function getConfigValue(key: string, fallback = ''): string {
  const val = cache[key];
  return val !== undefined && val !== '' ? val : fallback;
}

export function getConfigFilePath(): string {
  return resolvePath();
}

export function getSyncServerUrl(): string {
  return getConfigValue('SYNC_SERVER_URL', 'http://localhost:3001');
}

export function getSyncApiKey(): string {
  return getConfigValue('SYNC_API_KEY', '');
}

export function getUpdateFeedUrl(): string {
  return getConfigValue('UPDATE_FEED_URL', '');
}
