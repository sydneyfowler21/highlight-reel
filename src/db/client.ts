import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export const DEFAULT_DB_PATH = 'data/highlight-reel.db';

export function createDb(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export type HighlightReelDb = ReturnType<typeof createDb>;

export function applyMigrations(db: HighlightReelDb) {
  migrate(db, { migrationsFolder: join(process.cwd(), 'migrations') });
}
