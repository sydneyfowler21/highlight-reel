# Highlight Reel

[![CI](https://github.com/sydneyfowler21/highlight-reel/actions/workflows/ci.yml/badge.svg)](https://github.com/sydneyfowler21/highlight-reel/actions/workflows/ci.yml)

This project turns a youth-sports game recording and a messy list of auto-detected moments into a 60-second highlight reel a coach can review and then share with the team. Each raw detection has a play type, a time range, the players involved, and a confidence score. The same play may be detected more than once, some moments sit at the very start or end of the game, some rows are invalid, and there is often more action than will fit in a short recap.

## Rules

- Throw a `RangeError` when the recording's duration is not a finite number above 0. A NaN duration would drop every moment, and an infinite one would let clip ends run forever.
- Throw a `RangeError` when a setting is out of range: `capMs` must be a finite number above 0, and `prePadMs` and `postPadMs` must each be a finite number at or above 0.
- Skip a raw moment that is missing a required field, has a time or confidence score that is not a finite number, has a player list that is not a list of player ids, ends at or before it starts, lies entirely outside the recording (it ends at or before 0:00, or starts at or after the recording ends), has a confidence score outside 0 to 1, belongs to a different recording, or uses an unrecognized play type.
- Trim a raw moment that is partly outside the recording to the part inside it, before merging: a start before 0:00 becomes 0:00, and an end past the recording's end becomes that end. The play happened in the game, so it is kept rather than skipped.
- Two raw moments are the same play when they share a recording, have the same play type, and their time ranges overlap or are within one second of each other. Merge those moments into one: earliest start, latest end, highest confidence, and the combined player list.
- Add `prePadMs` of padding before each merged moment and `postPadMs` after it, two and three seconds by default, then clamp the result so a clip never starts before 0:00 and never ends after the recording does.
- Give every clip a unique id, `clip-<n>`, numbered from 0 in start order across all clips, candidates included, when the reel is built, never by where a clip sits in the reel. An id never changes, so a clip that joins the reel later keeps its id.
- Cap the reel at `capMs`, 60 seconds by default. Include as many goals as will fit, with no overlapping clips. Fill any remaining time in this order: save, then big play, then skill, then near miss. Within the same play type, prefer higher confidence. Skip a candidate that overlaps a clip already in the reel or that does not fit the remaining time. Sort the finished reel by start time.
- A reel does not store whether it is shareable. `isShareable(reel)` works it out from the reel's current clips: true only when the reel has at least one clip, every clip in it is approved, and the total duration is at or under the cap. A newly built reel is never shareable, because every clip in it is pending.

## How to run it

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run format:check
```

`npm test` runs the Jest tests in `src/__tests__/`: unit tests for each step of the pipeline plus end-to-end `buildReelFromRawMoments` runs. Tests marked `it.failing` record known bugs; they pass while the bug exists and fail once it is fixed, as a reminder to switch them to `it`. `npm run typecheck` type-checks the project, including the tests, with TypeScript in strict mode. `npm run lint` runs ESLint. `npm run format:check` checks formatting with Prettier.

## Usage

The included fixture is a 10-minute recording and the raw moments below (`recording` and `rawMoments` in `src/__tests__/seedGame.ts`). Passing that input to `buildReelFromRawMoments` with the default settings produces the reel that follows. `npm test` checks this same run.

`buildReelFromRawMoments` is the entry point, and it checks the recording and settings before running any step. `filterRawMoments`, `trimToRecording`, `mergeRawMoments`, `convertToClips`, and `selectClips` are exported for unit tests and expect input that has already been checked. `convertToClips` takes the padding settings and `selectClips` takes the cap, both required, since filling in defaults is `buildReelFromRawMoments`'s job. `selectClips` also takes the clips to keep, which it starts from: their time counts against the cap, a clip that overlaps one is skipped, and they are returned in `selected` with the clips it adds. A kept clip is never dropped, even when the kept clips already take more than the cap; every other clip then becomes a candidate. The two lists are expected to be separate, with no clip in both. `buildReelFromRawMoments` keeps none, and backfill after a reject keeps the clips still in the reel. `isShareable(reel)` reports whether a reel is ready to share, as defined in Rules.

`buildReelFromRawMoments` takes an optional third argument, a `ReelSettings` object with `capMs`, `prePadMs`, and `postPadMs`. It defaults to the exported `DEFAULT_REEL_SETTINGS`, `{ capMs: 60000, prePadMs: 2000, postPadMs: 3000 }`. To change one setting, spread the defaults: `buildReelFromRawMoments(recording, rawMoments, { ...DEFAULT_REEL_SETTINGS, capMs: 90000 })`. The reel's `capMs` reports the cap it was built under, and its `rejected` list starts empty.

Input:

```json
{
  "recording": {
    "id": "rec-1",
    "durationMs": 600000
  },
  "rawMoments": [
    {
      "recordingId": "rec-1",
      "type": "goal",
      "startMs": 58000,
      "endMs": 62000,
      "players": ["p1", "p3"],
      "confidence": 0.8
    },
    {
      "recordingId": "rec-1",
      "type": "goal",
      "startMs": 60000,
      "endMs": 65000,
      "players": ["p1", "p2"],
      "confidence": 0.95
    },
    {
      "recordingId": "rec-1",
      "type": "goal",
      "startMs": 508000,
      "endMs": 512000,
      "players": ["p3"],
      "confidence": 0.9
    },
    {
      "recordingId": "rec-1",
      "type": "goal",
      "startMs": 596000,
      "endMs": 599000,
      "players": ["p1"],
      "confidence": 0.88
    },
    {
      "recordingId": "rec-1",
      "type": "save",
      "startMs": 1000,
      "endMs": 4000,
      "players": ["p4"],
      "confidence": 0.8
    },
    {
      "recordingId": "rec-1",
      "type": "save",
      "startMs": 120000,
      "endMs": 124000,
      "players": ["p5"],
      "confidence": 0.92
    },
    {
      "recordingId": "rec-1",
      "type": "save",
      "startMs": 126000,
      "endMs": 130000,
      "players": ["p6"],
      "confidence": 0.4
    },
    {
      "recordingId": "rec-1",
      "type": "bigPlay",
      "startMs": 200000,
      "endMs": 206000,
      "players": ["p7"],
      "confidence": 0.85
    },
    {
      "recordingId": "rec-1",
      "type": "bigPlay",
      "startMs": 250000,
      "endMs": 255000,
      "players": ["p8"],
      "confidence": 0.7
    },
    {
      "recordingId": "rec-1",
      "type": "bigPlay",
      "startMs": 300000,
      "endMs": 306000,
      "players": ["p9"],
      "confidence": 0.6
    },
    {
      "recordingId": "rec-1",
      "type": "skill",
      "startMs": 80000,
      "endMs": 81000,
      "players": ["p10"],
      "confidence": 0.8
    },
    {
      "recordingId": "rec-1",
      "type": "skill",
      "startMs": 350000,
      "endMs": 351000,
      "players": ["p11"],
      "confidence": 0.65
    },
    {
      "recordingId": "rec-1",
      "type": "nearMiss",
      "startMs": 450000,
      "endMs": 454000,
      "players": ["p12"],
      "confidence": 0.88
    },
    {
      "recordingId": "rec-1",
      "type": "nearMiss",
      "startMs": 470000,
      "endMs": 475000,
      "players": ["p13"],
      "confidence": 0.6
    },
    {
      "recordingId": "rec-1",
      "type": "goal",
      "startMs": 200000,
      "endMs": 100000,
      "players": ["p1"],
      "confidence": 0.9
    },
    {
      "recordingId": "rec-1",
      "type": "save",
      "startMs": 140000,
      "endMs": 145000,
      "players": ["p5"],
      "confidence": 1.4
    },
    {
      "recordingId": "rec-2",
      "type": "goal",
      "startMs": 60000,
      "endMs": 65000,
      "players": ["p1"],
      "confidence": 0.99
    },
    {
      "recordingId": "rec-1",
      "type": "foul",
      "startMs": 90000,
      "endMs": 95000,
      "players": ["p1"],
      "confidence": 0.9
    }
  ]
}
```

Output:

```json
{
  "clips": [
    {
      "id": "clip-0",
      "startMs": 0,
      "endMs": 7000,
      "type": "save",
      "confidence": 0.8,
      "players": ["p4"],
      "status": "pending"
    },
    {
      "id": "clip-1",
      "startMs": 56000,
      "endMs": 68000,
      "type": "goal",
      "confidence": 0.95,
      "players": ["p1", "p2", "p3"],
      "status": "pending"
    },
    {
      "id": "clip-2",
      "startMs": 78000,
      "endMs": 84000,
      "type": "skill",
      "confidence": 0.8,
      "players": ["p10"],
      "status": "pending"
    },
    {
      "id": "clip-3",
      "startMs": 118000,
      "endMs": 127000,
      "type": "save",
      "confidence": 0.92,
      "players": ["p5"],
      "status": "pending"
    },
    {
      "id": "clip-5",
      "startMs": 198000,
      "endMs": 209000,
      "type": "bigPlay",
      "confidence": 0.85,
      "players": ["p7"],
      "status": "pending"
    },
    {
      "id": "clip-11",
      "startMs": 506000,
      "endMs": 515000,
      "type": "goal",
      "confidence": 0.9,
      "players": ["p3"],
      "status": "pending"
    },
    {
      "id": "clip-12",
      "startMs": 594000,
      "endMs": 600000,
      "type": "goal",
      "confidence": 0.88,
      "players": ["p1"],
      "status": "pending"
    }
  ],
  "candidates": [
    {
      "id": "clip-4",
      "startMs": 124000,
      "endMs": 133000,
      "type": "save",
      "confidence": 0.4,
      "players": ["p6"],
      "status": "pending"
    },
    {
      "id": "clip-6",
      "startMs": 248000,
      "endMs": 258000,
      "type": "bigPlay",
      "confidence": 0.7,
      "players": ["p8"],
      "status": "pending"
    },
    {
      "id": "clip-7",
      "startMs": 298000,
      "endMs": 309000,
      "type": "bigPlay",
      "confidence": 0.6,
      "players": ["p9"],
      "status": "pending"
    },
    {
      "id": "clip-8",
      "startMs": 348000,
      "endMs": 354000,
      "type": "skill",
      "confidence": 0.65,
      "players": ["p11"],
      "status": "pending"
    },
    {
      "id": "clip-9",
      "startMs": 448000,
      "endMs": 457000,
      "type": "nearMiss",
      "confidence": 0.88,
      "players": ["p12"],
      "status": "pending"
    },
    {
      "id": "clip-10",
      "startMs": 468000,
      "endMs": 478000,
      "type": "nearMiss",
      "confidence": 0.6,
      "players": ["p13"],
      "status": "pending"
    }
  ],
  "rejected": [],
  "capMs": 60000
}
```

## Design

The reel is built as a pipeline of small, pure functions:

1. **Filter** drops invalid or out-of-scope raw moments.
2. **Trim** cuts each moment that is partly outside the recording down to the part inside it.
3. **Merge** combines detections of the same play type that overlap or are within one second of each other into one moment.
4. **Pad/clamp** adds the configured padding before and after each merged moment, clamps the clip to the recording, and leaves it pending review.
5. **Select under the cap** fills the configured cap by taking goals first, then the other play types in priority order, skipping overlaps and clips that do not fit.
6. **Sort** puts the selected clips in chronological order.

> TODO: why it's built this way (author to write)

A newly built reel is never shareable, because every clip still needs review. Each step has its own unit tests, and an end-to-end test runs the whole pipeline against a 10-minute fixture.

The code has no comments, on purpose, and the rule that bans them has no escape hatches. Both choices are as much for the AI agents that work on this repo as for people. A comment is guidance nothing enforces: it can quietly go stale, and an agent will read a comment next to a bad fix as a reason to keep the fix rather than correct it. An `eslint-disable` or `@ts-expect-error` does the same harm, telling the next agent that silencing a check is acceptable. So when something goes wrong, the lesson becomes a lint rule, a type, or a test whose failure says what to fix, not a note someone has to remember to read.

Intent lives in names, structure, and tests instead: fixtures are named for the case they cover, a known bug gets an `it.failing` test named for the bug, and setup a comment would have described is asserted. The `local/no-comments` rule in `eslint.config.js` enforces this. Inline ESLint config is turned off, so `eslint-disable` has no effect, and every `@ts-` suppression is banned, so lint and type errors get fixed rather than silenced. CI runs lint on every push.

## Plan

Today this is a library that builds a reel from one game's raw moments. The plan turns it into a small service a coach's UI can call: it stores reels, serves a reel by id, and lets the coach review the reel one clip at a time. A milestone is done when tests, typecheck, lint, and format pass, and the behavior it finishes is moved into Rules.

### Decisions

- **Stack.** Node, Hono for HTTP, Zod to check request bodies, and SQLite through Drizzle.
- **The library stays pure. The API works by id.** `approve(reel, clipId)` and `reject(reel, clipId)` take a reel and return a new one, with no database involved. The API is the layer that takes ids: it loads the reel by id, calls the function, and saves the result. A client never sends a full reel.
- **A reel has its own id.** A recording can have more than one reel, because a rebuild makes a new one. The library's `Reel` type has no id; the storage layer adds the id, the recording id, and a version around it. Clip ids are unique only within a reel, so clip routes are nested under the reel: `/reels/:reelId/clips/:clipId`.
- **A reel is stored as one row.** The library's whole `Reel` goes in one JSON column, so each review action is one read and one write. See Database.
- **A review save checks the version with `If-Match`.** Every response that returns a reel sends its version as an `ETag` header. A review request must send that value back in `If-Match`. If the reel has changed since, the API returns 412 instead of overwriting the other change. A request with no `If-Match` returns 428, so no client can skip the check.
- **Status codes.** Approve and reject throw a `ReviewError`, a `RangeError` with a `reason`. A reason of `unknown-id` becomes 404. `already-approved`, `already-rejected`, and `not-in-reel` become 409. An invalid request body is 400.
- **Conflicts return the current reel.** The library treats every repeated action as an error, approving twice included, because it reports exactly what happened. The API decides how forgiving to be. Every 409 and 412 response includes the current reel and its `ETag`, so a UI that retries after a dropped response just shows the reel it gets back. This one rule covers retries of both approve and reject.
- **Error body.** Every error response is `{ reason, message, reel }`. `reason` is a fixed string the UI can branch on, and `message` is for people. `reel` is the current reel in the normal response shape, sent with its `ETag` whenever the reel exists. It is left out for a missing `If-Match` or an unknown reel id.
- **Which error wins.** A review request is checked in this order, and the first failure is the response:
  1. No `If-Match`: 428, reason `if-match-required`.
  2. Unknown reel id: 404, reason `reel-not-found`.
  3. `If-Match` does not match the stored version: 412, reason `stale-version`. This check comes before the review rules, so a stale request about a clip that has since been approved gets a 412, not a 409.
  4. The review action throws a `ReviewError`: 404 for `unknown-id`, otherwise 409, with the error's own reason.
  5. The conditional save changes no row, because someone saved after step 3: 412, reason `stale-version`, with the reel read again so it is current.

  Step 3 only makes the common case answer early. Step 5 is what actually prevents the race.

- **Zod checks request bodies only.** Raw moments are still checked row by row in `filterRawMoments`, so one bad row is skipped instead of failing the batch.

### Database

- **Tables.** `recordings` has an id and a duration. `reels` has an id, a recording id, a version, a created-at time, and a `reel` column that holds the library's `Reel` as JSON. Storing the whole `Reel` in one column means a change to the `Reel` type does not need a schema change.
- **Reel ids are random UUIDs** from `crypto.randomUUID()`. They appear in URLs, and counting ids would let anyone guess other reels.
- **The version is an integer that starts at 1.** Every save adds 1. The `ETag` is the version in quotes, like `"3"`, as HTTP requires.
- **A save only succeeds if nobody saved first.** It runs `UPDATE reels SET reel = ?, version = version + 1 WHERE id = ? AND version = ?`, and if no row changes, the API returns 412. Checking `If-Match` first and saving in a separate step would let two clicks both pass the check.
- **The latest reel for a recording** is the one created most recently. Two reels created in the same millisecond are ordered by when they were inserted.
- **The response body is** `{ id, recordingId, shareable, clips, candidates, rejected, capMs }`. `shareable` is worked out by `isShareable` when the reel is read and is never stored. The version is sent only as the `ETag`, so it has one source.
- **Folder layout.** The library stays in the top level of `src/`. Database code goes in `src/db/` and HTTP code in `src/api/`. A lint rule stops the top-level library files from importing either folder, `hono`, or `drizzle-orm`.
- **Left to whoever builds milestone 1:** which SQLite driver to use, where the database file lives (it is gitignored), and whether the seed command resets the database first.

### Milestones

Milestone 0 is the contract between the two tracks. Milestones 1 and 2 then run in parallel, and milestone 3 starts when both are merged.

#### 0. Shared contract (done)

- [x] `isShareable(reel)` works out whether a reel is shareable, and `Reel` no longer stores it.
- [x] `Reel` has a `rejected` list, empty when built.
- [x] `buildReel` is renamed `buildReelFromRawMoments`.
- [x] The review signatures are agreed, to be built in milestone 2: `approve(reel, clipId): Reel`, `reject(reel, clipId): Reel`, and `ReviewError` with the four reasons above.

#### 1. Database and get-reel API

- [ ] The `recordings` and `reels` tables from Database, with migrations.
- [ ] A seed command that stores the seed game's recording and builds its reel.
- [ ] `GET /recordings/:recordingId/reel` returns the recording's latest reel, with its reel id and `shareable`, and its version as an `ETag` header. It returns 404 when the recording does not exist or has no reel.
- [ ] `GET /reels/:reelId` returns one reel the same way, or 404.
- [ ] API tests run against an in-memory SQLite database.
- [ ] A lint rule that stops library code in `src/` from importing database or HTTP code.

#### 2. Coach review in the library

- [ ] Everything in Coach review below. When it is done, its rules move into Rules.

#### 3. Review endpoints

- [ ] `POST /reels/:reelId/clips/:clipId/approve` and `POST /reels/:reelId/clips/:clipId/reject`. Each one loads the reel, applies the action, and saves with the conditional `UPDATE ... WHERE version = ?` from Database, using the version from `If-Match`. The save is what catches a stale version. Errors follow the order in Which error wins. On success, it returns the new reel with its new `ETag`.
- [ ] One test for each step in Which error wins, plus one where a stale `If-Match` names a clip that has since been approved and gets a 412, not a 409.

#### Later, not planned yet

- Endpoints to add recordings and raw moments, and to build a new reel. Until then, the seed command provides the data.
- A review UI that calls the endpoints.
- Auth: who counts as a coach for a reel.

### Out of scope

- **Sharing.** Nothing is shared in this version. `isShareable` reports whether a reel is ready, and that is as far as this version goes.

### Coach review

Not built yet. When it is, these become Rules and each gets its own test.

A coach's UI calls approve and reject in whatever order the coach clicks. Skipping a clip is just not acting on it yet: it stays pending, and the reel is not shareable while any clip is pending. Review order does not have to match game order. The reel is always sorted by start time, so a backfill from earlier in the game simply appears earlier. This is why ids stay stable: the coach acts on a clip, not on its position in the reel.

- Review acts on a built reel, one clip at a time, by id. It is not a rebuild: no clip gets a new id, and clips still in the reel keep their place and status.
- Approve and reject each return a new reel and do not change the reel passed in, like the rest of the pipeline.
- Approving a pending clip sets it to approved and locks it in place. An approved clip never moves or leaves the reel.
- Rejecting a pending clip removes it from the reel and adds it to the reel's list of rejected clips. Then the fill step from Rules runs over the leftover time, using the candidates. Pending clips stay where they are too, and their time counts against the leftover.
- A rejected clip is never a candidate again, so it cannot come back as its own backfill. After a backfill, both the rejected clip and any backfilled clip are gone from `candidates`. Backfill passes `selectClips` the reel's remaining candidates only, so after any approve or reject every id is in exactly one of `clips`, `candidates`, or `rejected`.
- A backfilled clip starts as pending, and the reel stays sorted by start time.
- Throw a `ReviewError`, a `RangeError` whose message names the id and the case, when the id does not exist in the reel's clips, candidates, or rejected clips; when the id was already rejected; when the id belongs to a candidate that is not in the reel; or when the clip is already approved, whether the action is approve or reject. Its `reason` is `unknown-id`, `already-rejected`, `not-in-reel`, or `already-approved`, so the API can choose a status code without parsing the message.

Tests to write, one each:

- Approving or rejecting an id that does not exist.
- Approving or rejecting an id that was already rejected.
- Approving or rejecting a candidate id that is not in the reel.
- Approving a clip that is already approved.
- Rejecting a clip that is already approved: it throws `already-approved`, and the clip stays in the reel.
- Approve and reject leave the reel passed in unchanged.
- Approving the last pending clip makes the reel shareable.
- Rejecting the only clip, with no candidate to backfill, leaves an empty reel that is not shareable.
- Rejecting a clip when no candidate fits the leftover time: the reel gets shorter, and it is shareable if every clip left is approved.
- Rejecting a clip in an otherwise all-approved reel, where a backfill fits, leaves the reel not shareable because the backfilled clip is pending.
- A rejected clip appears in the rejected list and is not backfilled into its own leftover time.
- After a backfill, neither the rejected clip nor the backfilled clip is in `candidates`.
- After a reject with backfill, every id is in exactly one of `clips`, `candidates`, or `rejected`.
- Backfill does not move or change an approved clip, and the backfilled clip keeps its built id.
- A backfill that lands earlier in the game than the clips already in the reel keeps the reel sorted by start time.
- A candidate that overlaps a pending clip is skipped for backfill, and so is one that does not fit the leftover time.
- Rejecting a late clip lets an earlier candidate backfill: the approved clips do not move, and the reel is not shareable until the new clip is approved.

A rebuild from new input, such as re-detected moments or new settings, is a new reel whose ids may differ, and its review starts over.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
