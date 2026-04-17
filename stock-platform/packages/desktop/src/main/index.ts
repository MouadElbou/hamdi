import { app, BrowserWindow, shell, dialog, session } from 'electron';
import { join } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync, writeFileSync } from 'fs';
import Database from 'better-sqlite3';
import { initDatabase, getDatabase } from './database.js';
import { registerIpcHandlers, clearSession, getCurrentSession } from './ipc-handlers.js';
import { SyncManager } from './sync-manager.js';
import { loadRuntimeConfig, reloadRuntimeConfig, getConfigFilePath, getUpdateFeedUrl } from './runtime-config.js';
import { initAutoUpdater, checkForUpdatesNow, quitAndInstall } from './auto-updater.js';

let mainWindow: BrowserWindow | null = null;
let syncManager: SyncManager | null = null;
let dbPath: string | null = null;

// ─── Single-instance lock ─────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const BACKUP_RETENTION_DAYS = parseInt(process.env['BACKUP_RETENTION_DAYS'] ?? '7', 10) || 7;

// ─── Auto-backup: daily on startup, keep last 7 days ──────────────
async function runAutoBackup(_dbFilePath: string, userDataPath: string): Promise<void> {
  try {
    const backupDir = join(userDataPath, 'backups');
    mkdirSync(backupDir, { recursive: true });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const todayBackup = join(backupDir, `stock-backup-${today}.db`);

    // Skip if today's backup already exists
    if (existsSync(todayBackup)) {
      console.log('[BACKUP] Today\'s backup already exists, skipping');
      return;
    }

    // Use SQLite online backup API for crash-safe backup
    await getDatabase().backup(todayBackup);
    console.log('[BACKUP] Daily backup created:', todayBackup);

    // Prune old backups beyond retention window
    const files = readdirSync(backupDir)
      .filter(f => f.startsWith('stock-backup-') && f.endsWith('.db'));
    const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const file of files) {
      const filePath = join(backupDir, file);
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          unlinkSync(filePath);
          console.log('[BACKUP] Pruned old backup:', file);
        }
      } catch { console.warn('[BACKUP] Could not prune backup:', file); }
    }
  } catch (err) {
    console.error('[BACKUP] Auto-backup failed:', (err as Error).message);
  }
}

// ─── Crash handlers (I-19) ────────────────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('[CRASH] Uncaught exception:', error.message, error.stack);
  try {
    getDatabase().pragma('wal_checkpoint(TRUNCATE)');
    getDatabase().close();
  } catch { /* DB may not be initialized yet */ }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] Unhandled rejection:', reason);
  try {
    getDatabase().pragma('wal_checkpoint(TRUNCATE)');
    getDatabase().close();
  } catch { /* DB may not be initialized yet */ }
  process.exit(1);
});

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.cjs');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Stock Platform — Back Office',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // In dev mode, load vite dev server; in prod, load built files
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Forward renderer console messages to terminal for debugging
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const labels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[RENDERER:${labels[level] ?? level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[RENDERER] Page failed to load: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[RENDERER] DOM ready');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch { /* invalid URL — ignore */ }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    clearSession();
    mainWindow = null;
  });

  // DH-3: Set CSP and security headers on all responses in the renderer
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDev = process.env['NODE_ENV'] !== 'production';
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:5173"
            : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'",
        ],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        ...(isDev ? {} : { 'Strict-Transport-Security': ['max-age=31536000; includeSubDomains'] }),
      },
    });
  });
}

app.whenReady().then(async () => {
  // Load runtime config from userData/.env (editable after install)
  loadRuntimeConfig();
  console.log('[INIT] Runtime config loaded from', getConfigFilePath());

  // Initialize local SQLite database (graceful if native module missing)
  let dbAvailable = false;
  try {
    const userDataPath = app.getPath('userData');
    console.log('[INIT] userData path:', userDataPath);
    dbPath = join(userDataPath, 'stock-platform.db');
    const generatedPassword = initDatabase(userDataPath);
    console.log('[INIT] Database initialized and seeded');
    syncManager = new SyncManager(getDatabase());
    registerIpcHandlers(syncManager);
    console.log('[INIT] IPC handlers registered');

    // ─── Backup / Restore IPC (C-13) ──────────────────────────────
    const { ipcMain } = await import('electron');

    ipcMain.handle('backup:create', async () => {
      const session = getCurrentSession();
      if (!session || session.role !== 'admin') throw new Error('Accès réservé aux administrateurs');
      if (!dbPath || !mainWindow) throw new Error('Database not available');
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Sauvegarder la base de données',
        defaultPath: `stock-backup-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });
      if (!filePath) return { cancelled: true };
      // Use SQLite online backup API for crash-safe backup
      await getDatabase().backup(filePath);
      // Audit log
      try { getDatabase().prepare("INSERT INTO audit_log (user_id, username, action, detail) VALUES (?, ?, 'BACKUP_CREATE', ?)").run(session?.userId, session?.username, filePath); } catch { /* table may not exist */ }
      return { success: true, path: filePath };
    });

    ipcMain.handle('backup:restore', async () => {
      const session = getCurrentSession();
      if (!session || session.role !== 'admin') throw new Error('Accès réservé aux administrateurs');
      if (!dbPath || !mainWindow) throw new Error('Database not available');
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Restaurer la base de données',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile'],
      });
      if (!filePaths || filePaths.length === 0) return { cancelled: true };
      const sourcePath = filePaths[0]!;
      if (!existsSync(sourcePath)) throw new Error('Fichier de sauvegarde introuvable');
      // Validate the file is a valid SQLite database with expected tables
      try {
        const testDb = new Database(sourcePath, { readonly: true });
        const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
        testDb.close();
        const names = tables.map(t => t.name);
        const required = ['purchase_lots', 'sale_orders', 'users', 'suppliers'];
        const missing = required.filter(t => !names.includes(t));
        if (missing.length > 0) throw new Error(`Tables manquantes: ${missing.join(', ')}`);
      } catch (err) {
        if ((err as Error).message.includes('Tables manquantes')) throw err;
        throw new Error(`Fichier invalide: ce n'est pas une base de données Stock Platform valide`);
      }
      // Create safety backup before restore
      const safetyPath = dbPath + '.pre-restore-' + Date.now();
      getDatabase().pragma('wal_checkpoint(TRUNCATE)');
      copyFileSync(dbPath, safetyPath);
      // Stop sync before closing DB to prevent timer firing on closed DB
      syncManager?.stop();
      // Close and replace
      getDatabase().close();
      copyFileSync(sourcePath, dbPath!);
      // Restart app to reload with new DB
      app.relaunch();
      app.exit(0);
      return { success: true };
    });

    // ─── Runtime config IPC (edit .env after install) ─────────────
    ipcMain.handle('config:get-path', () => getConfigFilePath());
    ipcMain.handle('config:open-file', async () => {
      const sess = getCurrentSession();
      if (!sess || sess.role !== 'admin') throw new Error('Accès réservé aux administrateurs');
      const p = getConfigFilePath();
      if (!existsSync(p)) reloadRuntimeConfig();
      shell.showItemInFolder(p);
      return { path: p };
    });
    ipcMain.handle('config:reload', () => {
      const sess = getCurrentSession();
      if (!sess || sess.role !== 'admin') throw new Error('Accès réservé aux administrateurs');
      reloadRuntimeConfig();
      return { success: true };
    });

    // ─── Auto-updater IPC ─────────────────────────────────────────
    ipcMain.handle('updater:check', async () => {
      const sess = getCurrentSession();
      if (!sess || sess.role !== 'admin') throw new Error('Accès réservé aux administrateurs');
      return await checkForUpdatesNow();
    });
    ipcMain.handle('updater:install', () => {
      const sess = getCurrentSession();
      if (!sess || sess.role !== 'admin') throw new Error('Accès réservé aux administrateurs');
      quitAndInstall();
    });

    syncManager.start();

    // Run automatic daily backup
    runAutoBackup(dbPath, userDataPath);

    // Initialize auto-updater (only when feed URL configured and running packaged app)
    if (getUpdateFeedUrl() && app.isPackaged) {
      try {
        initAutoUpdater(() => mainWindow);
        console.log('[INIT] Auto-updater initialized');
      } catch (err) {
        console.error('[INIT] Auto-updater init failed:', (err as Error).message);
      }
    } else {
      console.log('[INIT] Auto-updater disabled (no UPDATE_FEED_URL or not packaged)');
    }

    dbAvailable = true;
    console.log('[INIT] App fully initialized with database');

    // Save generated admin password to a secure file (not a visible dialog)
    if (generatedPassword) {
      const credentialsPath = join(userDataPath, 'INITIAL_CREDENTIALS.txt');
      writeFileSync(credentialsPath, [
        'Stock Platform — Initial Admin Credentials',
        '============================================',
        '',
        'Utilisateurs : hicham / samir',
        `Mot de passe : ${generatedPassword}`,
        '',
        'Vous devrez changer ce mot de passe a la premiere connexion.',
        'IMPORTANT: Supprimez ce fichier apres avoir note le mot de passe.',
        '',
        `Fichier cree le : ${new Date().toISOString()}`,
      ].join('\n'), 'utf-8');
      app.once('browser-window-created', () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'Mot de passe administrateur initial',
          message: 'Les comptes administrateurs ont été créés.',
          detail: `Le mot de passe initial a été enregistré dans :\n${credentialsPath}\n\nSupprimez ce fichier après l'avoir consulté.`,
          buttons: ['OK'],
        });
      });
    }
  } catch (err) {
    console.error('[INIT] DATABASE INIT FAILED:', (err as Error).message);
    console.error('[INIT] Stack:', (err as Error).stack);
  }

  createWindow();

  if (!dbAvailable && mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.executeJavaScript(
        `document.title = 'Stock Platform — UI Only (no local DB)'`
      );
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  syncManager?.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── Graceful shutdown: wait for sync, then close database cleanly ─
app.on('before-quit', async (event) => {
  if (syncManager) {
    event.preventDefault();
    try {
      await syncManager.stopGracefully(5000);
    } catch (err) {
      console.error('[SHUTDOWN] Error during graceful sync stop:', (err as Error).message);
    }
    syncManager = null;
    try {
      getDatabase().pragma('wal_checkpoint(TRUNCATE)');
      getDatabase().close();
    } catch { /* DB may already be closed (restore flow) */ }
    app.quit();
  } else {
    try {
      getDatabase().pragma('wal_checkpoint(TRUNCATE)');
      getDatabase().close();
    } catch { /* DB may already be closed */ }
  }
});

// ─── Focus existing window on second-instance launch ──────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
