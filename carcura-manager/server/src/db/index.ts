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

export { schema };
