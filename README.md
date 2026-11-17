# Highlight Reel

This project turns a youth-sports game recording and a messy list of auto-detected moments into a 60-second highlight reel a coach can review and then share with the team. Each raw detection has a play type, a time range, the players involved, and a confidence score. The same play may be detected more than once, some moments sit at the very start or end of the game, some rows are invalid, and there is often more action than will fit in a short recap.

## Rules

- Skip a raw moment that is missing a required field, ends at or before it starts, has a confidence score outside 0 to 1, belongs to a different recording, or uses an unrecognized play type.
- Two raw moments are the same play when they share a recording, have the same play type, and their time ranges overlap or are within one second of each other. Merge those moments into one: earliest start, latest end, highest confidence, and the combined player list.
- Add two seconds of padding before each merged moment and three seconds after it, then clamp the result so a clip never starts before 0:00 and never ends after the recording does.
- Cap the reel at 60 seconds. Include as many goals as will fit, with no overlapping clips. Fill any remaining time in this order: save, then big play, then skill, then near miss. Within the same play type, prefer higher confidence. Skip a candidate that overlaps a clip already in the reel or that does not fit the remaining time. Sort the finished reel by start time.
- A newly built reel is not shareable. Shareable is true only when the reel has at least one clip, every clip in it is approved, and the total duration is at or under the cap.

## How to run it

```bash
npm install
npm test
npm run typecheck
```

`npm test` runs the included happy-path fixture and prints how many checks passed or failed. `npm run typecheck` type-checks the project with TypeScript in strict mode.

## Design

The reel is built as a pipeline of small, pure functions:

1. **Filter** drops invalid or out-of-scope raw moments.
2. **Merge** combines overlapping detections of the same play type into one moment.
3. **Pad** (`convertToClips`) adds watchable time before and after each merged moment, clamps to the recording, and produces clips that start in a pending review state.
4. **Select** fills the 60-second cap by taking goals first, then the other play types in priority order, skipping overlaps and clips that do not fit.
5. **Sort** puts the selected clips in chronological order.

A newly built reel always reports `shareable` as false, because every clip still needs review. The current test is one end-to-end check of this pipeline against a 10-minute fixture.

## Next steps

- Honor the one-second merge-gap rule, so moments of the same type that almost touch are treated as the same play.
- Merge correctly when other play types interleave between detections of the same play.
- Add unit tests for each function, including bad input, the one-second gap, padding at 0:00 and at the end of the recording, and selection at the exact cap.
- Add the coach-review step: approve a clip, or reject it and backfill a next-best play into the leftover time without moving clips already approved.
- Pass the cap and padding in as settings instead of hard-coding them.
