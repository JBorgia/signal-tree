---
name: signaltree-release
description: Execute an authorized SignalTree release phase using the current release controller and exact-artifact validation. Use for release preparation, verification or resumption; it does not authorize publication.
---

# SignalTree release work

Read `AGENTS.md` and `RELEASE-CURRENT.md` from this checkout. Check HEAD and
unrelated work. Follow the controller's current scope and linked validation /
release tooling; do not preload RELEASE-1.0.md or revive its historical phases.

Continue authorized work through the phase, validating focused changes before
required gates and checkpointing only owned files. Preserve failures, exact
artifact identity and remaining blockers. Rebuild after mutation tests before
final artifact verification. Do not turn a completed check into a new API or
product assignment.

Use independent review under `docs/review-contract.md` at consequential changes
and release closure. Escalate real semantic/product/compatibility decisions;
ordinary local fixes do not need another permission request. Push, tag and
publication still require explicit user authorization.
