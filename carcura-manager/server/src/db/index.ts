import { CompatDatabase } from './sqlite.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { BetterSQLiteSession } from 'drizzle-orm/better-sqlite3/session';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core/db';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core/dialect';
import { createTableRelationsHelpers, extractTablesRelationalConfig } from 'drizzle-orm/relations';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
  db: Db;
  sqlite: CompatDatabase;
  close(): void;
}

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export function openDatabase(dbPath: string): DbHandle {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new CompatDatabase(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  // Drizzle-Instanz ohne das native Paket better-sqlite3: Session und Dialekt direkt zusammensetzen
  // (entspricht drizzle-orm/better-sqlite3/driver.js, das sonst better-sqlite3 laden würde).
  const dialect = new SQLiteSyncDialect({});
  const tables = extractTablesRelationalConfig(schema, createTableRelationsHelpers);
  const relational = { fullSchema: schema, schema: tables.tables, tableNamesMap: tables.tableNamesMap };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = new BetterSQLiteSession(sqlite as any, dialect, relational as any, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new BaseSQLiteDatabase('sync', dialect, session as any, relational as any) as unknown as Db;
  (db as unknown as { $client: unknown }).$client = sqlite;
  migrate(db, { migrationsFolder });
  return { db, sqlite, close: () => sqlite.close() };
}

/**
 * Anzahl noch nicht angewendeter Migrationen einer bestehenden Datenbank (0 bei neuer Datenbank).
 * Wird vor dem Start genutzt, um vor Schemaänderungen automatisch eine Sicherung anzulegen.
 */
export function pendingMigrationCount(dbPath: string): number {
  if (dbPath === ':memory:' || !fs.existsSync(dbPath)) return 0;
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ when: number }> };
  const sqlite = new CompatDatabase(dbPath);
  try {
    const hasTable = sqlite.prepare("select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'").get();
    if (!hasTable) return 0;
    // Gleiche Regel wie der Drizzle-Migrator: ausstehend ist, was jünger als die zuletzt angewendete Migration ist
    const last = Number((sqlite.prepare('select max(created_at) as t from __drizzle_migrations').get() as { t: number | null }).t ?? 0);
    return journal.entries.filter((e) => e.when > last).length;
  } finally { sqlite.close(); }
}

export { schema };
