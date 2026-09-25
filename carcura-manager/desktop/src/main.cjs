'use strict';
/**
 * Carcura Management – Windows-Desktop-Anwendung (Electron-Hauptprozess).
 *
 * Architektur: Die Desktop-App ist der Client, das zentrale Backend (Carcura-Server, online)
 * ist die einzige Datenquelle. Die App speichert keine Geschäftsdaten lokal. Sie lädt die
 * Oberfläche vom konfigurierten Server in ein eigenes Programmfenster; es wird kein
 * installierter Browser benötigt.
 *
 * Sicherheit:
 *  - Renderer ohne Node-Zugriff (contextIsolation, sandbox, nodeIntegration aus)
 *  - Navigation nur zum eigenen Server und zu den lokalen App-Seiten; alles andere öffnet
 *    der Standardbrowser (nur https, mailto, tel)
 *  - Nur HTTPS, Ausnahme: localhost und private Netze für Test/Werkstatt-Server
 *  - Zertifikatsfehler werden nie übergangen
 *  - Anmeldung als HttpOnly-Cookie in einer eigenen, persistenten Sitzung; Cookie-Verschlüsselung
 *    über Windows (DPAPI) per Electron-Fuse (siehe package.json → electronFuses)
 *  - HTTP-Cache wird beim Beenden geleert (keine Kundendaten im Cache des PCs)
 */
const { app, BrowserWindow, Menu, shell, session, ipcMain, protocol, net, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const lib = require('./lib.cjs');

const PARTITION = 'persist:carcura';
const LOCAL_SCHEME = 'carcura';
const LOCAL_ORIGIN = `${LOCAL_SCHEME}://app`;
const UI_DIR = path.join(__dirname, 'ui');
const APP_CONFIG = loadAppConfig();
const HEALTH_TIMEOUT_MS = 10_000;

protocol.registerSchemesAsPrivileged([{ scheme: LOCAL_SCHEME, privileges: { standard: true, secure: true } }]);

/* ------------------------------------------------------------------ Konfiguration */
function loadAppConfig() {
  const defaults = { productName: 'Carcura Management', defaultServerUrl: '', lockServerUrl: false, updateUrl: '', supportUrl: 'https://carcura.info', allowPrivateHttp: true };
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app-config.json'), 'utf8'));
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
}

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}
function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  const tmp = `${settingsFile()}.tmp`;
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, settingsFile());
  return next;
}
function currentServer() {
  const s = readSettings();
  if (APP_CONFIG.lockServerUrl && APP_CONFIG.defaultServerUrl) return normalizeServerUrl(APP_CONFIG.defaultServerUrl).origin;
  return s.serverUrl || (APP_CONFIG.defaultServerUrl ? normalizeServerUrl(APP_CONFIG.defaultServerUrl).origin : '');
}

/* ------------------------------------------------------------------ Server-Adresse prüfen */
const normalizeServerUrl = (input) => lib.normalizeServerUrl(input, { allowPrivateHttp: APP_CONFIG.allowPrivateHttp });
const { compareVersions } = lib;

async function checkServer(origin) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await net.fetch(`${origin}/api/health`, { signal: ctl.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, reason: `Der Server antwortet mit Fehler ${res.status}.` };
    const j = await res.json().catch(() => null);
    if (!j || j.ok !== true) return { ok: false, reason: 'Unter dieser Adresse läuft kein Carcura-Server.' };
    const updateRequired = j.minDesktopVersion ? compareVersions(app.getVersion(), j.minDesktopVersion) < 0 : false;
    return { ok: true, serverVersion: j.version, minDesktopVersion: j.minDesktopVersion || null, updateRequired };
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'Zeitüberschreitung – der Server antwortet nicht.' : `Keine Verbindung (${(err && err.message) || 'unbekannter Fehler'}).`;
    return { ok: false, reason: `${msg} Bitte Internetverbindung prüfen.` };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ Fenster */
let mainWindow = null;
let lastError = '';

function isServerUrl(url) {
  const server = currentServer();
  if (!server) return false;
  try { return new URL(url).origin === server; } catch { return false; }
}
function isLocalUrl(url) {
  try { return new URL(url).origin === LOCAL_ORIGIN; } catch { return false; }
}
function openExternalSafe(url) {
  if (lib.isSafeExternal(url)) void shell.openExternal(new URL(url).toString());
}

function showLocal(mode, extra = {}) {
  if (!mainWindow) return;
  const q = new URLSearchParams({ mode, ...extra });
  void mainWindow.loadURL(`${LOCAL_ORIGIN}/connect.html?${q.toString()}`);
}

async function connect() {
  const server = currentServer();
  if (!server) return showLocal('setup');
  showLocal('connecting', { server });
  const r = await checkServer(server);
  if (!r.ok) { lastError = r.reason; return showLocal('offline', { server, reason: r.reason }); }
  if (r.updateRequired) return showLocal('update', { server, min: r.minDesktopVersion || '' });
  lastError = '';
  await mainWindow.loadURL(`${server}/`);
}

function createWindow() {
  const s = readSettings();
  const b = s.bounds || {};
  mainWindow = new BrowserWindow({
    width: b.width || 1400, height: b.height || 900, x: b.x, y: b.y, minWidth: 1024, minHeight: 680,
    show: false, backgroundColor: '#0B0B0C', title: APP_CONFIG.productName, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true,
      allowRunningInsecureContent: false, spellcheck: true, devTools: !app.isPackaged,
    },
  });
  if (s.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => {
    if (!mainWindow) return;
    writeSettings({ bounds: mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  // Server nicht erreichbar (Netzwerkfehler beim Laden einer Seite des Servers)
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* abgebrochen */ || !isServerUrl(url)) return;
    lastError = `Verbindung unterbrochen (${desc}).`;
    showLocal('offline', { server: currentServer(), reason: lastError });
  });
  void connect();
}

/* ------------------------------------------------------------------ Sicherheitsregeln für alle Fenster */
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
  const guard = (e, url) => {
    if (isServerUrl(url) || isLocalUrl(url)) return;
    e.preventDefault();
    openExternalSafe(url);
  };
  contents.on('will-navigate', guard);
  contents.on('will-redirect', guard);
  contents.setWindowOpenHandler(({ url }) => {
    // Dokumente/PDFs des eigenen Servers in einem eigenen App-Fenster (gleiche Anmeldung)
    if (isServerUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#0B0B0C', webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true, nodeIntegration: false, plugins: true, devTools: !app.isPackaged } } };
    }
    openExternalSafe(url);
    return { action: 'deny' };
  });
});

function hardenSession(ses) {
  ses.setUserAgent(`${ses.getUserAgent()} CarcuraManagementDesktop/${app.getVersion()}`);
  const allowed = new Set(['clipboard-sanitized-write', 'fullscreen', 'notifications', 'media']);
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(allowed.has(permission) && isServerUrl(details.requestingUrl || wc.getURL()));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && isServerUrl(origin));
  ses.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({ title: 'Datei speichern', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
  });
}

/* ------------------------------------------------------------------ IPC (nur aus vertrauenswürdigen Seiten) */
function senderOrigin(event) {
  try { return new URL(event.senderFrame.url).origin; } catch { return ''; }
}
function fromLocal(event) { return senderOrigin(event) === LOCAL_ORIGIN; }
function fromServer(event) { return isServerUrl(event.senderFrame.url); }

ipcMain.on('desktop:info', (event) => {
  if (!fromLocal(event) && !fromServer(event)) { event.returnValue = null; return; }
  event.returnValue = { version: app.getVersion(), platform: process.platform, serverUrl: currentServer(), productName: APP_CONFIG.productName, lockServerUrl: Boolean(APP_CONFIG.lockServerUrl && APP_CONFIG.defaultServerUrl), lastError };
});
ipcMain.handle('shell:connect', async (event, input) => {
  if (!fromLocal(event)) return { ok: false, reason: 'Nicht erlaubt.' };
  if (APP_CONFIG.lockServerUrl && APP_CONFIG.defaultServerUrl) return { ok: false, reason: 'Die Server-Adresse ist in dieser Version fest eingestellt.' };
  const n = normalizeServerUrl(input);
  if (n.error) return { ok: false, reason: n.error };
  const r = await checkServer(n.origin);
  if (!r.ok) return { ok: false, reason: r.reason };
  writeSettings({ serverUrl: n.origin });
  setTimeout(() => void connect(), 50);
  return { ok: true, origin: n.origin, insecure: Boolean(n.insecure) };
});
ipcMain.handle('shell:retry', (event) => { if (fromLocal(event)) setTimeout(() => void connect(), 50); return true; });
ipcMain.handle('shell:openSupport', (event) => { if (fromLocal(event) && APP_CONFIG.supportUrl) openExternalSafe(APP_CONFIG.supportUrl); return true; });
ipcMain.on('desktop:changeServer', (event) => { if (fromServer(event) || fromLocal(event)) changeServer(); });
ipcMain.on('desktop:reload', (event) => { if (fromServer(event) || fromLocal(event)) void connect(); });

function changeServer() {
  if (APP_CONFIG.lockServerUrl && APP_CONFIG.defaultServerUrl) {
    void dialog.showMessageBox(mainWindow, { type: 'info', message: 'Die Server-Adresse ist in dieser Version fest eingestellt.' });
    return;
  }
  showLocal('setup', { server: currentServer(), change: '1' });
}

async function clearLocalData() {
  const r = await dialog.showMessageBox(mainWindow, {
    type: 'warning', buttons: ['Abbrechen', 'Löschen und abmelden'], defaultId: 0, cancelId: 0,
    message: 'Lokale Anmeldedaten löschen?',
    detail: 'Anmeldung, Zwischenspeicher und Einstellungen dieser App werden auf diesem PC gelöscht. Ihre Daten auf dem Server bleiben unverändert.',
  });
  if (r.response !== 1) return;
  const ses = session.fromPartition(PARTITION);
  await ses.clearStorageData();
  await ses.clearCache();
  void connect();
}

/* ------------------------------------------------------------------ Menü */
function buildMenu() {
  const template = [
    {
      label: APP_CONFIG.productName,
      submenu: [
        { label: 'Startseite', accelerator: 'Alt+Home', click: () => void connect() },
        { label: 'Server-Adresse ändern …', click: () => changeServer(), enabled: !(APP_CONFIG.lockServerUrl && APP_CONFIG.defaultServerUrl) },
        { label: 'Lokale Anmeldedaten löschen …', click: () => void clearLocalData() },
        ...(APP_CONFIG.updateUrl ? [{ label: 'Nach Updates suchen', click: () => checkForUpdates(true) }] : []),
        { type: 'separator' },
        { role: 'quit', label: 'Beenden' },
      ],
    },
    { label: 'Bearbeiten', submenu: [{ role: 'undo', label: 'Rückgängig' }, { role: 'redo', label: 'Wiederholen' }, { type: 'separator' }, { role: 'cut', label: 'Ausschneiden' }, { role: 'copy', label: 'Kopieren' }, { role: 'paste', label: 'Einfügen' }, { role: 'selectAll', label: 'Alles auswählen' }] },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Vergrößern' }, { role: 'zoomOut', label: 'Verkleinern' }, { role: 'resetZoom', label: 'Originalgröße' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools', label: 'Entwicklerwerkzeuge' }] : []),
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        ...(APP_CONFIG.supportUrl ? [{ label: 'Support-Website', click: () => openExternalSafe(APP_CONFIG.supportUrl) }] : []),
        { label: `Über ${APP_CONFIG.productName}`, click: () => void dialog.showMessageBox(mainWindow, { type: 'info', title: APP_CONFIG.productName, message: `${APP_CONFIG.productName} ${app.getVersion()}`, detail: `Server: ${currentServer() || 'nicht eingerichtet'}\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}` }) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ Updates (optional) */
let updater = null;
function checkForUpdates(interactive) {
  if (!APP_CONFIG.updateUrl || !app.isPackaged) {
    if (interactive) void dialog.showMessageBox(mainWindow, { type: 'info', message: 'Automatische Updates sind in dieser Version nicht eingerichtet.' });
    return;
  }
  try {
    if (!updater) {
      updater = require('electron-updater').autoUpdater;
      updater.setFeedURL({ provider: 'generic', url: APP_CONFIG.updateUrl });
      updater.autoDownload = true;
      updater.on('update-downloaded', async (info) => {
        const r = await dialog.showMessageBox(mainWindow, { type: 'info', buttons: ['Später', 'Jetzt neu starten'], defaultId: 1, message: `Version ${info.version} ist bereit.`, detail: 'Die Anwendung wird zum Installieren neu gestartet.' });
        if (r.response === 1) updater.quitAndInstall();
      });
      updater.on('error', (err) => { if (interactive) void dialog.showMessageBox(mainWindow, { type: 'warning', message: 'Update-Prüfung fehlgeschlagen.', detail: String(err && err.message) }); });
    }
    void updater.checkForUpdates();
  } catch (err) {
    if (interactive) void dialog.showMessageBox(mainWindow, { type: 'warning', message: 'Update-Prüfung nicht möglich.', detail: String(err && err.message) });
  }
}

/* ------------------------------------------------------------------ Start */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.setAppUserModelId('de.carcura.management');
  app.whenReady().then(() => {
    // Lokale App-Seiten (Verbindung, Offline, Update) über ein eigenes, sicheres Schema
    protocol.handle(LOCAL_SCHEME, (request) => {
      const file = lib.resolveUiFile(UI_DIR, request.url, path);
      if (!file) return new Response('Nicht gefunden', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    hardenSession(session.fromPartition(PARTITION));
    buildMenu();
    createWindow();
    checkForUpdates(false);
  });
  app.on('window-all-closed', () => app.quit());
  // Zwischenspeicher mit Kundendaten nicht auf dem PC liegen lassen
  app.on('before-quit', () => { try { void session.fromPartition(PARTITION).clearCache(); } catch { /* ignorieren */ } });
}

