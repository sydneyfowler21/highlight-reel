# Highlight Reel

[![CI](https://github.com/sydneyfowler21/highlight-reel/actions/workflows/ci.yml/badge.svg)](https://github.com/sydneyfowler21/highlight-reel/actions/workflows/ci.yml)

This project turns a youth-sports game recording and a messy list of auto-detected moments into a 60-second highlight reel a coach can review and then share with the team. Each raw detection has a play type, a time range, the players involved, and a confidence score. The same play may be detected more than once, some moments sit at the very start or end of the game, some rows are invalid, and there is often more action than will fit in a short recap.

## Rules

- Throw a `RangeError` when the recording's duration is not a finite number above 0. A NaN duration would drop every moment, and an infinite one would let clip ends run forever.
- Throw a `RangeError` when a setting is out of range: `capMs` must be a finite number above 0, and `prePadMs` and `postPadMs` must each be a finite number at or above 0.
- Skip a raw moment that is missing a required field, has a time or confidence score that is not a finite number, has a player list that is not a list of player ids, ends at or before it starts, has a confidence score outside 0 to 1, belongs to a different recording, or uses an unrecognized play type.
- Two raw moments are the same play when they share a recording, have the same play type, and their time ranges overlap or are within one second of each other. Merge those moments into one: earliest start, latest end, highest confidence, and the combined player list.
- Add `prePadMs` of padding before each merged moment and `postPadMs` after it, two and three seconds by default, then clamp the result so a clip never starts before 0:00 and never ends after the recording does.
- Give every clip a unique id: `clip-<n>`, numbered from 0 in start order.
- Cap the reel at `capMs`, 60 seconds by default. Include as many goals as will fit, with no overlapping clips. Fill any remaining time in this order: save, then big play, then skill, then near miss. Within the same play type, prefer higher confidence. Skip a candidate that overlaps a clip already in the reel or that does not fit the remaining time. Sort the finished reel by start time.
- A newly built reel is not shareable. Shareable is true only when the reel has at least one clip, every clip in it is approved, and the total duration is at or under the cap.

## How to run it

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run format:check
```

`npm test` runs the Jest tests in `src/__tests__/`: unit tests for each step of the pipeline plus end-to-end `buildReel` runs. Tests marked `it.failing` record known bugs; they pass while the bug exists and fail once it is fixed, as a reminder to switch them to `it`. `npm run typecheck` type-checks the project, including the tests, with TypeScript in strict mode. `npm run lint` runs ESLint. `npm run format:check` checks formatting with Prettier.

## Usage

The included fixture is a 10-minute recording and the raw moments below (`recording` and `rawMoments` in `src/__tests__/seedGame.ts`). Passing that input to `buildReel` with the default settings produces the reel that follows. `npm test` checks this same run.

`buildReel` is the entry point, and it checks the recording and settings before running any step. `filterRawMoments`, `mergeRawMoments`, `convertToClips`, and `selectClips` are exported for unit tests and expect a recording that has already been checked. `convertToClips` takes the padding settings and `selectClips` takes the cap, both required, since filling in defaults is `buildReel`'s job.

`buildReel` takes an optional third argument, a `ReelSettings` object with `capMs`, `prePadMs`, and `postPadMs`. It defaults to the exported `DEFAULT_REEL_SETTINGS`, `{ capMs: 60000, prePadMs: 2000, postPadMs: 3000 }`. To change one setting, spread the defaults: `buildReel(recording, rawMoments, { ...DEFAULT_REEL_SETTINGS, capMs: 90000 })`. The reel's `capMs` reports the cap it was built under.

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
  "shareable": false,
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
  "capMs": 60000
}
```

## Design

The reel is built as a pipeline of small, pure functions:

1. **Filter** drops invalid or out-of-scope raw moments.
2. **Merge** combines detections of the same play type that overlap or are within one second of each other into one moment.
3. **Pad/clamp** adds the configured padding before and after each merged moment, clamps the clip to the recording, and leaves it pending review.
4. **Select under the cap** fills the configured cap by taking goals first, then the other play types in priority order, skipping overlaps and clips that do not fit.
5. **Sort** puts the selected clips in chronological order.

> TODO: why it's built this way (author to write)

A newly built reel always reports `shareable` as false, because every clip still needs review. Each step has its own unit tests, and an end-to-end test runs the whole pipeline against a 10-minute fixture.

The code has no comments, on purpose, and the rule that bans them has no escape hatches. Both choices are as much for the AI agents that work on this repo as for people. A comment is guidance nothing enforces: it can quietly go stale, and an agent will read a comment next to a bad fix as a reason to keep the fix rather than correct it. An `eslint-disable` or `@ts-expect-error` does the same harm, telling the next agent that silencing a check is acceptable. So when something goes wrong, the lesson becomes a lint rule, a type, or a test whose failure says what to fix, not a note someone has to remember to read.

Intent lives in names, structure, and tests instead: fixtures are named for the case they cover, a known bug gets an `it.failing` test named for the bug, and setup a comment would have described is asserted. The `local/no-comments` rule in `eslint.config.js` enforces this. Inline ESLint config is turned off, so `eslint-disable` has no effect, and every `@ts-` suppression is banned, so lint and type errors get fixed rather than silenced. CI runs lint on every push.

## Next steps

- Add the coach-review step: approve a clip, or reject it and backfill a next-best play into the leftover time without moving clips already approved. Review only changes the status of clips in the built reel, so their ids stay put. A rebuild from new input, such as re-detected moments or new cap and padding settings, is a new reel whose ids may differ, and its review starts over.
