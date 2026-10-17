# B native boundary revision R1

Baseline: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Rejected native checkpoint: `2d9ed132addd52a2ee5f3a85456be32426dd299f`.
Branch: `codex/native-ownership-slice`. This revision is the commit containing this record; source hashes accompany the evidence archive. The predecessor README and archive remain unchanged.

## Boundary correction

Native slots/descriptors remain current truth. Pending contribution records resolve settlement; no canonical value mirror or incumbent compensation engine is installed. This is an internal scalar/member slice, not public transact integration.

Dynamic creation now prepares existence before construction/discoverability, validates after potentially reentrant construction, then pairs responsibility with descriptor/link/index installation before publication. New descendants register before delivery. Existing member replacement, omission, reacquisition and descendant writes use the shared scalar/presence participation. Ancestor existence contributions preserve later surviving descendant truth.

Settlement uses the existing mixed `preparePlainBranchMembers` installation/publication path. A presence-only internal target represents Boolean existence without implicitly authoring its entire subtree. Existing callers keep whole-value semantics. Member-address registration was factored from diagnostic lowering so installation no longer relies on diagnostic capture. All prepared values/membership, the shared physical revision advance, and ownership terminality precede delivery. The existing exposed-state filter prevents announcing hidden retained values. Observer writes remain authored because capture suppression spans trusted installation only.

No application-facing API or native-computed timing promise changes. Preparation faults and stale preparation refuse before installation; this is not proof against arbitrary allocation failure in internal bookkeeping after native writes. Full public transaction identity, lifecycle and inspection remain unintegrated. Native driver destruction is explicit; model destruction controls are not proof of complete tree/driver lifecycle integration.

## Preserved first failures

- Predecessor original13: 11 pass, dynamic creation rollback and scalar path delivery fail. Original assertions are retained.
- First R1 run: 9 pass/4 fail; member-address lookup relied on diagnostic lowering. Shared registration corrected it.
- Expanded first run: 10 pass/2 fail; subtree value restoration overrode independently resolved scalar truth, and primitive dynamic replacement remained stale. Presence-only targets corrected the first.
- Independent review found hidden scalar path delivery and recovery offered after already-terminal abort delivery failure. Raw red sources/logs remain archived. Exposed-state publication and terminality-aware callback-error precedence corrected these.
- A later coordinator audit reproduced a stale raw frame committing after rollback (17 pass/1 fail). The shared preparer intentionally delegates physical revision advancement to its caller. The driver now advances the existing clock after installation and before terminality/delivery; the unchanged red replay passes.
- Typecheck initially rejected implicit plan typing and an invalid transaction-confirm origin. Explicit plan types and the existing origin contract corrected these; spec fixture typing and two const lint errors were also corrected. Assertions were preserved, with stronger actual-undefined checks added. No public types or ratchets were weakened.
- Primitive dynamic replacement remains a separate baseline counterexample. Driver-attached and detached assertions remain ordinary red tests. An independent exact8d source probe also fails (expected3, got1); no baseline runtime edits. This is not silently classified unsupported or made an expected pass. Record-shaped replacement coverage does not establish primitive materialization semantics.

## Independent review

Read-only review initially ran original13 and expanded17: 30 ordinary passes. The final expanded suite adds the physical-revision regression; final review and runs are recorded in RESULTS.md. Root inspected the changed installation and publication ordering and independently reproduced primitive replacement against exact8d. Reviewer findings above were reproduced before correction. Review claims are limited to the exercised scalar/member boundary, not entities, Link integration, all-framework B semantics or general allocation-failure atomicity.

The unchanged neutral B recovery suite was rerun: 41 semantic passes, 14 adversarial passes, destruction control passes. These remain model evidence separate from native tests.

Validation results and exact commands are recorded in RESULTS.md. Raw logs, first-failure sources and trace are in evidence.tar.xz. No performance, heap, package/demo size or production acceptance claim is made.

## Replay

Use Node24.15.0 / pnpm10.17.0 from this worktree. `NX_DAEMON=false` and `--skip-nx-cache` apply to each Nx run.

```sh
pnpm nx test kernel --testFile=src/lib/native-ownership-experiment.spec.ts --skip-nx-cache
pnpm nx test kernel --testFile=src/lib/native-ownership-r1.spec.ts --skip-nx-cache
pnpm nx test kernel --testFile=src/lib/native-ownership-r1-baseline-counterexample.spec.ts --skip-nx-cache
```

The third command deliberately retains normal failing assertions; it is a preserved counterexample, not an acceptance gate silently waived. Recovery replay commands remain in ../recovery/README.md. The exact-baseline primitive fixture is archived for overlay onto unchanged8d source and an Nx run.

No push, merge, tag, publication, v15 change, API acceptance or ceiling change.
