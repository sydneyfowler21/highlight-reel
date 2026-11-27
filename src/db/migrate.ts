import { applyMigrations, createDb, DEFAULT_DB_PATH } from './client';

const db = createDb(DEFAULT_DB_PATH);
applyMigrations(db);
db.$client.close();
