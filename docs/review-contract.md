# Code and release review

Review the identified checkout/commit against the requested contract. Historical
findings are claims to recheck, not automatic current defects. Report concrete
correctness, atomicity, type, packaging, compatibility or measurement failures.
Distinguish release blockers from useful optimization opportunities and old debt.
A new spec-type regression is not excused by pre-existing errors.

For each finding, give file/line, violated contract, cheapest falsifier and whether
it ran. Say “no blocker demonstrated” when appropriate. Do not infer runtime
verification from source reading or numerical significance from one timing.

Do not edit/stage/commit production or architecture files as a reviewer. Default
to source/log inspection. Run scoped checks or isolated temporary reproductions
only when the task permits execution; coordinate against active performance or
mutation runs. Tests/builds can modify ignored artifacts, so they are not literally
read-only. Request the implementer run a falsifier if your tool permissions cannot.

Relevant validation commands use actual projects, e.g. `pnpm nx test kernel`;
inspect the affected package target and `node tools/verify-gates.mjs --list`.
For release scope load [the current controller](../RELEASE-CURRENT.md), not the
entire historical ledger. For consequential architecture use
[the independent protocol](../.github/skills/adversarial-confirmation/references/protocol.md).
