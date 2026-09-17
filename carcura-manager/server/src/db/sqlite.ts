import { DatabaseSync, type StatementSync } from 'node:sqlite';

/**
 * Dünne Kompatibilitätsschicht: stellt die von Drizzle (Treiber „better-sqlite3“) und dem
 * Backup-Modul benötigte API auf Basis des in Node.js eingebauten SQLite bereit.
 * Vorteil: keine nativen Abhängigkeiten, keine Kompilierung bei der Installation
 * (kein Visual Studio, kein Python, keine Prebuilt-Downloads) – wichtig für Laptops von Endkunden.
 */
type Param = string | number | bigint | Buffer | Uint8Array | null | boolean | undefined | Date;

function bind(params: Param[]): Array<string | number | bigint | Uint8Array | null> {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    return p as string | number | bigint | Uint8Array | null;
  });
}

export class CompatStatement {
  private arrays = false;
  constructor(private readonly stmt: StatementSync, readonly source: string) {}
  /** Ergebniszeilen als Arrays statt Objekte (Drizzle nutzt das für `values()` und Joins). */
  raw(on = true): this { this.arrays = on; this.stmt.setReturnArrays(on); return this; }
  run(...params: Param[]) { const r = this.stmt.run(...bind(params)); return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid }; }
  get(...params: Param[]) { return this.stmt.get(...bind(params)) as unknown; }
  all(...params: Param[]) { return this.stmt.all(...bind(params)) as unknown[]; }
  columns() { return this.stmt.columns(); }
  get reader(): boolean { return this.arrays || true; }
}

type TxFn<A extends unknown[], R> = (...args: A) => R;
export interface Transaction<A extends unknown[], R> { (...args: A): R; deferred: (...args: A) => R; immediate: (...args: A) => R; exclusive: (...args: A) => R }

export class CompatDatabase {
  private readonly db: DatabaseSync;
  private depth = 0;
  readonly name: string;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.name = path;
  }
  prepare(sql: string): CompatStatement { return new CompatStatement(this.db.prepare(sql), sql); }
  exec(sql: string): this { this.db.exec(sql); return this; }
  /** `pragma('journal_mode = WAL')` wie bei better-sqlite3; liefert die Ergebniszeilen. */
  pragma(text: string, opts: { simple?: boolean } = {}): unknown {
    const rows = this.db.prepare(`PRAGMA ${text}`).all() as Array<Record<string, unknown>>;
    if (opts.simple) { const first = rows[0]; return first ? Object.values(first)[0] : undefined; }
    return rows;
  }
  get inTransaction(): boolean { return this.depth > 0; }
  get open(): boolean { return this.db.isOpen; }
  close(): void { this.db.close(); }
  /** Transaktionen wie bei better-sqlite3: Funktion wird umschlossen, verschachtelt über SAVEPOINT. */
  transaction<A extends unknown[], R>(fn: TxFn<A, R>): Transaction<A, R> {
    const run = (mode: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE') => (...args: A): R => {
      const nested = this.depth > 0;
      const sp = `cm_sp_${this.depth}`;
      this.db.exec(nested ? `SAVEPOINT ${sp}` : `BEGIN ${mode}`);
      this.depth++;
      try {
        const result = fn(...args);
        this.depth--;
        this.db.exec(nested ? `RELEASE SAVEPOINT ${sp}` : 'COMMIT');
        return result;
      } catch (err) {
        this.depth--;
        try { this.db.exec(nested ? `ROLLBACK TO SAVEPOINT ${sp}; RELEASE SAVEPOINT ${sp}` : 'ROLLBACK'); } catch { /* bereits zurückgesetzt */ }
        throw err;
      }
    };
    const wrapped = run('DEFERRED') as Transaction<A, R>;
    wrapped.deferred = run('DEFERRED'); wrapped.immediate = run('IMMEDIATE'); wrapped.exclusive = run('EXCLUSIVE');
    return wrapped;
  }
}
