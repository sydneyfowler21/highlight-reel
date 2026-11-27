import { serve } from '@hono/node-server';
import { createApp } from './app';
import { parsePort } from './parsePort';
import { applyMigrations, createDb, DEFAULT_DB_PATH } from '../db/client';

const port = parsePort(process.env.PORT);
const hostname = process.env.HOST || '127.0.0.1';
const db = createDb(DEFAULT_DB_PATH);
applyMigrations(db);

serve(
  {
    fetch: createApp(db).fetch,
    hostname,
    port,
  },
  (info) => {
    console.log(`listening on ${hostname}:${info.port}`);
  },
);
