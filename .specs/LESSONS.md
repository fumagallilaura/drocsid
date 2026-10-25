# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Assert callback cardinality and pending-state removal when Electron capture is cancelled before inventory resolves.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `electron/capture` · harmful: 0
- features: build-confiavel
- evidence: validation.md M8; electron/main.js:53 (electron/capture)
- last seen: 2026-10-25T02:45:07Z

### L-002 - Assert that mocked-clock cleanup promises are terminal at the deadline before awaiting their result.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests/harness` · harmful: 0
- features: build-confiavel
- evidence: BUILD-08; tests/harness.test.js:33; validation.md M9 (tests/harness)
- last seen: 2026-10-25T02:45:13Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
