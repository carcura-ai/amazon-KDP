// Kleiner JSON-Speicher: eine Datei pro Sammlung, atomar geschrieben (erst .tmp, dann umbenennen).
// Für zwei Nutzer und ein paar hundert Anfragen im Jahr reicht das völlig.

import fs from "node:fs";
import path from "node:path";

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map();
    this.queue = Promise.resolve();
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, "inbox"), { recursive: true });
  }

  file(name) {
    return path.join(this.dir, `${name}.json`);
  }

  get(name, fallback) {
    if (this.cache.has(name)) return this.cache.get(name);
    let value = fallback;
    try {
      value = JSON.parse(fs.readFileSync(this.file(name), "utf8"));
    } catch (err) {
      if (err.code !== "ENOENT") console.error(`[store] ${name} nicht lesbar, starte leer:`, err.message);
    }
    this.cache.set(name, value);
    return value;
  }

  set(name, value) {
    this.cache.set(name, value);
    const target = this.file(name);
    const tmp = `${target}.${process.pid}.tmp`;
    // Schreibvorgänge nacheinander, damit sich nichts überholt.
    this.queue = this.queue.then(() => {
      fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
      fs.renameSync(tmp, target);
    }).catch((err) => console.error(`[store] ${name} nicht gespeichert:`, err.message));
    return this.queue;
  }

  update(name, fallback, fn) {
    const current = this.get(name, fallback);
    const next = fn(current) ?? current;
    this.set(name, next);
    return next;
  }

  flush() {
    return this.queue;
  }

  saveInboxFile(filename, buffer) {
    const safe = filename.replace(/[^\w.\-]/g, "_");
    const full = path.join(this.dir, "inbox", safe);
    fs.writeFileSync(full, buffer);
    return full;
  }
}

// Fortlaufende, gut lesbare IDs wie L-0007 oder V-0003.
export function nextId(store, prefix) {
  const counters = store.get("counters", {});
  const n = (counters[prefix] || 0) + 1;
  store.set("counters", { ...counters, [prefix]: n });
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
