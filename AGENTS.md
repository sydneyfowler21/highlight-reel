# Agent guidance

Read [SPEC.md](SPEC.md) first: it is the spec, and every behavior change starts there. The README's How it was built section explains how this repo records lessons.

## Prefer the better design over a smaller diff

When a fix involves a design choice, pick the simplest correct design, even if it changes many test expectations, fixtures, or examples in SPEC.md. Tests and fixtures that pin an incidental detail, like an id format, describe today's behavior. They are not requirements. Update them and list what changed in the PR description. A test that asserts a rule in SPEC.md stays as it is unless the rule itself changes.

Before writing the fix, name the options and say in the PR description why the chosen one wins. Ask whether the design would change if updating tests cost nothing. If it would, use that design.

Example: two clips that both pad back to 0:00 used to share the id `clip-0`. One fix keeps `clip-<paddedStart>` and adds a `-2`, `-3` count when starts collide, which leaves every existing id alone. The other numbers clips by position, `clip-<n>`, which is unique by construction and one line of code but renumbers ids across the tests and docs. The second is the better design, so the repo uses it.

This repo turns lessons into lint rules, types, or tests rather than notes. This rule stays a note because choosing the better design is a judgment call that no check can make.
