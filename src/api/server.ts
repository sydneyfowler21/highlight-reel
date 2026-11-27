import { serve } from '@hono/node-server';
import { createApp } from './app';
import { applyMigrations, createDb, DEFAULT_DB_PATH } from '../db/client';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const db = createDb(DEFAULT_DB_PATH);
applyMigrations(db);

serve(
  {
    fetch: createApp(db).fetch,
    hostname: '0.0.0.0',
    port,
  },
  (info) => {
    console.log(`listening on ${info.port}`);
  },
);
