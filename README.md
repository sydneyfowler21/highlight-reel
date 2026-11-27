# Highlight Reel

[![CI](https://github.com/sydneyfowler21/highlight-reel/actions/workflows/ci.yml/badge.svg)](https://github.com/sydneyfowler21/highlight-reel/actions/workflows/ci.yml)

Highlight Reel turns a youth-sports game recording and a messy list of auto-detected moments into a 60-second highlight reel that a coach reviews one clip at a time. The detections are noisy: the same play is found more than once, some moments run past the start or end of the game, some rows are invalid, and there is more action than fits.

It is a pure TypeScript library with a small HTTP service around it, built with Node 22, Hono, SQLite through Drizzle, and Jest. The full behavior is in [SPEC.md](SPEC.md), which the tests check.

## Try it

```bash
npm install
npm run seed
npm start
```

`npm run seed` stores a 10-minute game and builds its reel. In a second terminal, get that reel and keep its id:

```bash
curl -i localhost:3000/recordings/rec-1/reel
REEL=$(curl -s localhost:3000/recordings/rec-1/reel | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).id')
```

The response is a 200 with `ETag: "1"`. The reel has seven pending clips that fill the 60 seconds, six candidates that did not fit, and `"shareable": false`.

Approve the goal, sending back the version you saw:

```bash
curl -i -X POST -H 'If-Match: "1"' localhost:3000/reels/$REEL/clips/clip-1/approve
```

That returns 200 with `ETag: "2"`. Sending a request with the old version again, as a second coach or a stale tab would, returns 412 instead of overwriting the change:

```bash
curl -i -X POST -H 'If-Match: "1"' localhost:3000/reels/$REEL/clips/clip-0/approve
```

```json
{
  "reason": "stale-version",
  "message": "Reel … is at \"2\", not \"1\"",
  "reel": { "…": "the current reel" }
}
```

Reject the opening save. Its 7 seconds are backfilled from the candidates, and the approved goal stays in the reel:

```bash
curl -i -X POST -H 'If-Match: "2"' localhost:3000/reels/$REEL/clips/clip-0/reject
```

That returns 200 with `ETag: "3"`. `clip-0` is now in `rejected`, and `clip-8`, a 6-second skill from later in the game, has joined the reel as pending.

## How it works

The reel is built by a pipeline of small, pure functions:

1. **Filter** drops invalid or out-of-scope raw moments.
2. **Merge** combines detections of the same play type that overlap or are within one second of each other.
3. **Pad and clamp** adds a few seconds before and after each moment and keeps the clip inside the recording.
4. **Select** fills the cap with goals first, then saves, big plays, skills, and near misses, skipping overlaps and clips that do not fit.
5. **Sort** puts the reel in game order.

Then a coach reviews it. Approving a clip locks it in the reel. Rejecting one moves it to the rejected list and runs the select step again over the time it freed. A reel is shareable once every clip in it is approved.

The seed game exercises each of these cases: two overlapping detections of the same goal, a save at 0:01 and a goal at 9:56 that are clamped to the recording's edges, rows that are invalid or belong to another game, and more action than fits in 60 seconds. The fixture is in [`src/fixtures/seedGame.ts`](src/fixtures/seedGame.ts).

## Design decisions

**A pure library with a thin service around it.** Every rule lives in pure functions in `src/` that take a value and return an updated copy, with no database, clock, or network. The API loads a reel by id, calls one function, and saves the updated reel back under the same id. It never re-implements a rule, and a lint rule stops the library from importing database or HTTP code.

**Noisy input is skipped, not fatal.** Auto-detection is noisy, so raw moments are checked one at a time and a bad row is dropped rather than failing the batch. A moment that runs past the start or end of the game is kept and trimmed, because the play still happened. A bad recording or setting is different: it would make every result wrong, so it throws.

**Clip ids never change.** Ids are given once, when the reel is built. A coach acts on a clip, not on a position in the reel, so a backfill that lands earlier in the game can't change which clip an id points to.

**Approved clips are locked.** Nothing a coach does later drops an approved clip or changes it. A reject backfills only the time around the clips still in the reel, so one decision can't undo another. The reel is always listed in game order, so a backfill from early in the game appears before a clip approved from the end.

**The types rule out impossible reels.** A reel's clips are pending or approved, its candidates are pending, and its rejected clips are rejected. A reel whose lists disagree doesn't compile, so no code has to check for one.

**Two reviewers can't overwrite each other.** Every reel carries its version as an `ETag`, and a review must send it back in `If-Match`. The save is a single conditional `UPDATE` that only writes if the version is still the one the client saw. The slower of two clicks gets a 412 and the current reel instead of overwriting the other change. The version check comes before the review rules, so a stale request about a clip that has since been approved gets a 412, not a 409: that client is acting on a reel it hasn't seen.

**Every error tells the UI what to do next.** An error is `{ reason, message, reel }`: a fixed reason to branch on, a message for people, and the current reel whenever one exists. A UI that retries after a dropped response just shows the reel it gets back. The library reports every repeated action as an error, and the API decides how forgiving to be.

**One row per reel.** The whole reel is stored as JSON in one column, so each review is one read and one write, and a change to the `Reel` type needs no schema change. Stored reels that no longer fit a changed type need a data migration. Reel ids are random UUIDs, because they appear in URLs.

## Tests and checks

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

`npm test` runs the Jest tests in [`src/__tests__/`](src/__tests__), [`src/db/__tests__/`](src/db/__tests__), and [`src/api/__tests__/`](src/api/__tests__): each pipeline step, coach review, end-to-end builds of the seed game, the database queries and conditional save, and every API route, including one test per step of the review error order and a simulated race between two saves. The database and API tests run against an in-memory SQLite database. `npm run typecheck` checks the project, tests included, with TypeScript in strict mode. CI runs all four on every push.

Use Node 22, the version CI runs. Other versions may need `make` and a C++ compiler to build better-sqlite3. `npm run dev` restarts the server on changes, `PORT` changes its port from 3000, and `npm run db:generate` writes a migration from [`src/db/schema.ts`](src/db/schema.ts). `npm run seed` replaces the database file, so restart a running server after it.

## How it was built

I wrote the first version of the pipeline, `buildReel`, by hand. I then refined and extended it with AI agents, in small PRs that work from [AGENTS.md](AGENTS.md) and [SPEC.md](SPEC.md). Each PR names the design options it considered, and every PR got more than one AI review: a backend reviewer, and a QA agent that deliberately breaks the code to check that some test fails. When a review found a recurring problem, the fix became a check rather than a note: a lint rule, a type, or a test. The no-comments rule, the ban on suppressions, and the per-list clip status types all started that way.

The code has no comments, on purpose, and the rule that bans them has no escape hatches. Both choices are as much for the AI agents that work on this repo as for people. A comment is guidance nothing enforces: it can quietly go stale, and an agent will read a comment next to a bad fix as a reason to keep the fix rather than correct it. An `eslint-disable` or `@ts-expect-error` does the same harm, telling the next agent that silencing a check is acceptable.

Intent lives in names, structure, and tests instead: fixtures are named for the case they cover, a known bug gets an `it.failing` test named for the bug, and setup a comment would have described is asserted. The `local/no-comments` rule in [`eslint.config.js`](eslint.config.js) enforces this. Inline ESLint config is turned off, so `eslint-disable` has no effect, and every `@ts-` suppression is banned, so lint and type errors get fixed rather than silenced.

## What I'd add next

- **Rebuilds that don't strand a review.** An endpoint to build a new reel for a game. The old reel would record `replacedBy`, and a review on it would get a 409 with reason `reel-replaced` and the current reel, so a coach finds out the next time they act.
- **Endpoints to add recordings and raw moments.** For now, the seed command provides the data.
- **A review UI** that calls these endpoints and uses the `reason` on each error to decide what to show.
- **Auth**, to decide who counts as a coach for a reel.
- **Sharing.** `isShareable` reports whether a reel is ready, and that is as far as this version goes.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
