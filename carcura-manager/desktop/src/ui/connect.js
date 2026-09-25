'use strict';
(function () {
  const shell = window.carcuraShell;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'setup';
  const server = params.get('server') || (shell && shell.info.serverUrl) || '';
  const info = shell ? shell.info : { version: '?', productName: 'Carcura Management', lockServerUrl: false };

  $('product').textContent = info.productName;
  document.title = info.productName;
  $('footer').textContent = `Version ${info.version}`;
  const show = (name) => { for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== `view-${name}`; };
  const host = (s) => s.replace(/^https?:\/\//, '');

  if (!shell) { show('offline'); $('offline-reason').textContent = 'Diese Seite läuft nur in der Desktop-App.'; return; }

  if (mode === 'connecting') {
    $('subtitle').textContent = 'Verbindung wird hergestellt';
    $('server-connecting').textContent = host(server);
    show('connecting');
  } else if (mode === 'offline') {
    $('subtitle').textContent = 'Offline';
    $('server-offline').textContent = host(server);
    $('offline-reason').textContent = params.get('reason') || '';
    $('btn-change').hidden = info.lockServerUrl;
    show('offline');
  } else if (mode === 'update') {
    $('subtitle').textContent = 'Neue Version nötig';
    $('server-update').textContent = host(server);
    $('min-version').textContent = params.get('min') || '';
    $('app-version').textContent = info.version;
    show('update');
  } else {
    $('subtitle').textContent = params.get('change') ? 'Server-Adresse ändern' : 'Ersteinrichtung';
    $('url').value = server;
    $('btn-cancel').hidden = !params.get('change') || !server;
    show('setup');
    $('url').focus();
  }

  $('view-setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('btn-connect');
    btn.disabled = true; btn.textContent = 'Prüfe Verbindung …'; $('setup-error').textContent = '';
    const r = await shell.connect($('url').value);
    if (!r.ok) { btn.disabled = false; btn.textContent = 'Verbinden'; $('setup-error').textContent = r.reason; return; }
    btn.textContent = r.insecure ? 'Verbunden (unverschlüsselt, nur im lokalen Netz)' : 'Verbunden';
  });
  $('btn-cancel').addEventListener('click', () => shell.retry());
  $('btn-retry').addEventListener('click', () => shell.retry());
  $('btn-retry2').addEventListener('click', () => shell.retry());
  $('btn-change').addEventListener('click', () => { location.search = `?mode=setup&change=1&server=${encodeURIComponent(server)}`; });
  $('btn-support').addEventListener('click', () => shell.openSupport());
  $('btn-support2').addEventListener('click', () => shell.openSupport());
})();
