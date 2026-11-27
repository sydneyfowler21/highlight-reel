import { rmSync } from 'node:fs';
import { buildReelFromRawMoments } from '../highlightReel';
import { rawMoments, recording } from '../fixtures/seedGame';
import { applyMigrations, createDb, DEFAULT_DB_PATH } from './client';
import { insertReel } from './reels';
import { recordings } from './schema';

function resetDatabaseFile(path: string) {
  rmSync(path, { force: true });
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

resetDatabaseFile(DEFAULT_DB_PATH);

const db = createDb(DEFAULT_DB_PATH);
applyMigrations(db);
db.insert(recordings)
  .values({
    id: recording.id,
    durationMs: recording.durationMs,
  })
  .run();
insertReel(db, recording.id, buildReelFromRawMoments(recording, rawMoments));
db.$client.close();
