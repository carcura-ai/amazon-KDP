'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { normalizeServerUrl, compareVersions, isSafeExternal, resolveUiFile } = require('../src/lib.cjs');

test('Server-Adresse: https wird ergänzt, Pfad und Query entfernt', () => {
  assert.deepStrictEqual(normalizeServerUrl('app.carcura.info'), { origin: 'https://app.carcura.info' });
  assert.deepStrictEqual(normalizeServerUrl(' https://app.carcura.info/login?x=1 '), { origin: 'https://app.carcura.info' });
  assert.deepStrictEqual(normalizeServerUrl('https://app.carcura.info:8443/'), { origin: 'https://app.carcura.info:8443' });
});

test('Server-Adresse: http nur im lokalen Netz, nie öffentlich', () => {
  assert.deepStrictEqual(normalizeServerUrl('localhost:4800'), { origin: 'http://localhost:4800', insecure: true });
  assert.deepStrictEqual(normalizeServerUrl('192.168.178.20:4800'), { origin: 'http://192.168.178.20:4800', insecure: true });
  assert.ok(normalizeServerUrl('http://app.carcura.info').error);
  assert.ok(normalizeServerUrl('http://192.168.1.2', { allowPrivateHttp: false }).error);
});

test('Server-Adresse: ungültige und gefährliche Eingaben', () => {
  assert.ok(normalizeServerUrl('').error);
  assert.ok(normalizeServerUrl('file:///C:/Windows').error);
  assert.ok(normalizeServerUrl('javascript:alert(1)').error);
  assert.ok(normalizeServerUrl('https://user:pass@app.carcura.info').error);
});

test('Versionsvergleich', () => {
  assert.ok(compareVersions('1.0.0', '1.0.1') < 0);
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0);
  assert.strictEqual(compareVersions('2.0', '2.0.0'), 0);
});

test('Externe Links: nur https, mailto, tel', () => {
  assert.ok(isSafeExternal('https://wa.me/49170'));
  assert.ok(isSafeExternal('mailto:info@carcura.info'));
  assert.ok(!isSafeExternal('http://example.com'));
  assert.ok(!isSafeExternal('file:///C:/x.exe'));
  assert.ok(!isSafeExternal('javascript:alert(1)'));
});

test('Lokale Seiten: kein Zugriff außerhalb des UI-Ordners', () => {
  const ui = path.join(__dirname, '..', 'src', 'ui');
  assert.strictEqual(resolveUiFile(ui, 'carcura://app/connect.html', path), path.join(ui, 'connect.html'));
  // Punkt-Segmente löst der URL-Parser auf – das Ergebnis bleibt im UI-Ordner
  assert.ok(resolveUiFile(ui, 'carcura://app/../main.cjs', path).startsWith(ui + path.sep));
  // Kodierte Schrägstriche dürfen nicht aus dem Ordner führen
  assert.strictEqual(resolveUiFile(ui, 'carcura://app/..%2fmain.cjs', path), null);
  assert.strictEqual(resolveUiFile(ui, 'carcura://app/..%5cmain.cjs', path), path.sep === '\\' ? null : resolveUiFile(ui, 'carcura://app/..%5cmain.cjs', path));
  assert.strictEqual(resolveUiFile(ui, 'carcura://other/connect.html', path), null);
});
