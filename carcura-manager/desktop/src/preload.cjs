'use strict';
/**
 * Preload (läuft isoliert und in der Sandbox). Stellt der Oberfläche nur ein kleines,
 * festes Objekt bereit – keinen Zugriff auf Node, Dateisystem oder beliebige IPC-Kanäle.
 * Der Hauptprozess prüft bei jedem Aufruf zusätzlich die Herkunft der Seite.
 */
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('desktop:info');
const isLocal = window.location.protocol === 'carcura:';

if (info && isLocal) {
  // Lokale Seiten der App (Verbindung einrichten, offline, Update nötig)
  contextBridge.exposeInMainWorld('carcuraShell', {
    info: Object.freeze({ ...info }),
    connect: (url) => ipcRenderer.invoke('shell:connect', String(url || '')),
    retry: () => ipcRenderer.invoke('shell:retry'),
    openSupport: () => ipcRenderer.invoke('shell:openSupport'),
  });
} else if (info) {
  // Oberfläche des eigenen Servers
  contextBridge.exposeInMainWorld('carcuraDesktop', Object.freeze({
    isDesktop: true,
    version: info.version,
    platform: info.platform,
    serverUrl: info.serverUrl,
    lockServerUrl: info.lockServerUrl,
    changeServer: () => ipcRenderer.send('desktop:changeServer'),
    reload: () => ipcRenderer.send('desktop:reload'),
  }));
}
