# Spec

These rules are the contract for Highlight Reel. The tests check them, and agents working on the repo treat this file as the source of truth: a change in behavior starts here.

## Library

### Building a reel

- Throw a `RangeError` when the recording's duration is not a finite number above 0. A NaN duration would drop every moment, and an infinite one would let clip ends run forever.
- Throw a `RangeError` when a setting is out of range: `capMs` must be a finite number above 0, and `prePadMs` and `postPadMs` must each be a finite number at or above 0.
- Skip a raw moment that is missing a required field, has a time or confidence score that is not a finite number, has a player list that is not a list of player ids, ends at or before it starts, lies entirely outside the recording (it ends at or before 0:00, or starts at or after the recording ends), has a confidence score outside 0 to 1, belongs to a different recording, or uses an unrecognized play type.
- Two raw moments are the same play when they share a recording, have the same play type, and their time ranges overlap or are within one second of each other. Merge those moments into one: earliest start, latest end, highest confidence, and the combined player list.
- Add `prePadMs` of padding before each merged moment and `postPadMs` after it, two and three seconds by default, then clamp the result so a clip never starts before 0:00 and never ends after the recording does. A moment that is only partly outside the recording is kept, because the play happened in the game, and the clamp trims its clip to the part inside.
- Give every clip a unique id, `clip-<n>`, numbered from 0 in start order across all clips, candidates included, when the reel is built, never by where a clip sits in the reel. An id never changes, so a clip that joins the reel later keeps its id.
- Cap the reel at `capMs`, 60 seconds by default. Include as many goals as will fit, with no overlapping clips. Fill any remaining time in this order: save, then big play, then skill, then near miss. Within the same play type, prefer higher confidence. Skip a candidate that overlaps a clip already in the reel or that does not fit the remaining time. Sort the finished reel by start time. Candidates stay in fill order: play type first, then higher confidence.
- A reel does not store whether it is shareable. `isShareable(reel)` works it out from the reel's current clips: true only when the reel has at least one clip, every clip in it is approved, and the total duration is at or under the cap. A newly built reel is never shareable, because every clip in it is pending.

### Reviewing a reel

- A coach reviews a built reel one clip at a time, by id, with `approve` and `reject`, in any order. A clip the coach has not acted on stays pending. Review is not a rebuild: no clip gets a new id, and clips still in the reel keep their times and status. A rebuild from new input, such as re-detected moments or new settings, is a new reel whose ids may differ, and its review starts over.
- Approve and reject update a reel without changing the object passed in: each returns an updated copy, like the rest of the pipeline. It is still the same reel, with the same clips and ids. Only a rebuild makes a new reel.
- Approving a pending clip sets it to approved and locks it in the reel. An approved clip never leaves the reel and its times never change, so every candidate is pending. The reel stays sorted by start time, so a backfill from earlier in the game is listed before it.
- Rejecting a pending clip removes it from the reel, sets its status to rejected, and adds it to the end of the reel's list of rejected clips. Then the fill step above runs over the leftover time under the reel's own cap, using the reel's candidates. The clips still in the reel, pending and approved, stay in the reel unchanged, and their time counts against the leftover.
- A rejected clip is never a candidate again, so it cannot come back as its own backfill. After a backfill, the backfilled clip is gone from `candidates`, so after any approve or reject every id is in exactly one of `clips`, `candidates`, or `rejected`.
- A backfilled clip starts as pending and keeps the id it was built with, and the reel stays sorted by start time.
- Throw a `ReviewError`, a `RangeError` whose message names the id, when the id is not in the reel's clips, candidates, or rejected clips (`unknown-id`); when the id was already rejected (`already-rejected`); when the id belongs to a candidate that is not in the reel (`not-in-reel`); or when the clip is already approved, whether the action is approve or reject (`already-approved`). The error's `reason` holds that string, so the API can choose a status code without parsing the message.

### Functions

- `buildReelFromRawMoments(recording, rawMoments, settings?)` is the entry point. It checks the recording and settings, then runs every step. `settings` defaults to `DEFAULT_REEL_SETTINGS`, `{ capMs: 60000, prePadMs: 2000, postPadMs: 3000 }`. The reel's `capMs` reports the cap it was built under, and its `rejected` list starts empty.
- `filterRawMoments`, `mergeRawMoments`, `convertToClips`, and `selectClips` are exported for unit tests and expect input that has already been checked. `convertToClips` takes the padding settings and `selectClips` takes the cap, both required, since filling in defaults is `buildReelFromRawMoments`'s job.
- `selectClips(keptClips, clips, capMs)` starts from the kept clips: their time counts against the cap, a clip that overlaps one is skipped, and they are returned in `selected` with the clips it adds. A kept clip is never dropped, even when the kept clips already take more than the cap. The two lists are expected to be separate. `buildReelFromRawMoments` keeps none, and `reject` keeps the clips still in the reel.
- The `Reel` type says which statuses each list holds: `clips` holds pending and approved clips, `candidates` only pending ones, and `rejected` only rejected ones.

## API

- Every reel the API returns has the body `{ id, recordingId, shareable, clips, candidates, rejected, capMs }` and sends its version as an `ETag` header: an integer that starts at 1, in quotes, like `"1"`. `shareable` is worked out by `isShareable` when the reel is read and is never stored. The version is sent only as the `ETag`, never in the body.
- `GET /reels/:reelId` returns that reel. An unknown reel id returns 404 with reason `reel-not-found`.
- `GET /recordings/:recordingId/reel` returns the recording's latest reel: the one created most recently, or, when two were created in the same millisecond, the one inserted last. An unknown recording returns 404 with reason `recording-not-found`, and a recording with no reel returns 404 with reason `reel-not-found`.
- `POST /reels/:reelId/clips/:clipId/approve` approves a clip in the reel, and `POST /reels/:reelId/clips/:clipId/reject` rejects one and backfills the leftover time, as the Library rules describe. The request must send the reel's `ETag` in `If-Match`. The updated reel is saved over the stored one, under the same reel id, with a conditional save that adds 1 to the version only if nobody saved first. The response is 200 with the updated reel and its new `ETag`.
- A review request is checked in this order, and the first failure is the response:
  1. No `If-Match`, or an empty one: 428, reason `if-match-required`.
  2. Unknown reel id: 404, reason `reel-not-found`.
  3. `If-Match` is not exactly the reel's current `ETag`: 412, reason `stale-version`. A malformed header, such as `W/"1"` or `*`, is not the `ETag` either, so it gets a 412 too.
  4. The review action throws a `ReviewError`: 404 for `unknown-id`, otherwise 409, with the error's own reason. Any other error is a bug, so it is not caught and the response is 500.
  5. The conditional save changes no row, because someone saved after step 3: 412, reason `stale-version`, with the reel read again so it is current.
- An error response is `{ reason, message, reel }`. `reason` is a fixed string a UI can branch on, and `message` is for people. `reel` is the current reel in the normal response shape, sent with its `ETag`. It is left out, with no `ETag`, for a 428 and for a 404 for an unknown route, reel, or recording. A request to a route that does not exist is a 404 with reason `route-not-found`. An unexpected error is a 500 with reason `internal-error` and a generic message, never a reel or details from the error. The error itself is logged on the server.

## Storage

- `recordings` has an id and a duration. `reels` has a `seq`, an id, a recording id, a version, a created-at time, and a `reel` column that holds the library's `Reel` as JSON. Stored reels that no longer fit a changed `Reel` type need a data migration, or a reseed while the seed command is the only source of data.
- Reel ids are random UUIDs from `crypto.randomUUID()`, because they appear in URLs and counting ids would let anyone guess other reels.
- A save runs `UPDATE reels SET reel = ?, version = version + 1 WHERE id = ? AND version = ?`, and changes no row when the version has moved on. The check and the write are one statement, so two saves from the same version cannot both succeed.
- The latest reel for a recording is found by ordering on `created_at`, then on `seq`, both newest first. The index on `recording_id` and `created_at` covers the lookup.
- The library stays in the top level of [`src/`](src), database code in [`src/db/`](src/db), and HTTP code in [`src/api/`](src/api). A lint rule stops the top-level library files from importing `src/db`, `src/api`, `hono`, `@hono/node-server`, `drizzle-orm`, or `better-sqlite3`.
