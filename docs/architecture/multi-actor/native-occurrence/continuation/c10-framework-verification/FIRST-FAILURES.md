# First failure classification (verification only)

Input: C10 promoted manifest `de88e207c66e65a1a191d05ab4f2b5b2a4deeead71a06f239f278e28dee70dc4`. No source edits, reruns, kernel tests or builds.

## React: actual behavioral failures

Full React run: 85 passed / 6 failed, 15 passing files / 1 failing file. React's target-level TypeScript precheck completed, since Vitest ran. First raw run is `runs/react/first.log`.

All six failures are in `packages/react/src/absent-collection.spec.tsx`, each repeated for transactions-first and restoration-first enhancer order:

- Line 106: re-add through undoable addOne; expected whole-tree `a.rows.all` to contain `{id:'z',n:9}`, received `[]`; the same rendered output's direct `all()` contains the row and count is 1.
- Line 152: collection-only root; expected `users.all` in whole-tree snapshot to contain the new row, received `[]`; direct users.all() contains it.
- Line 262: re-add in transact; same stale whole-tree wrapper versus current direct collection result.

These are rendered useSignalTree assertions, not parked private-hook falsifiers or infrastructure errors. Although names mention undo/rollback, the FIRST failing assertions precede those operations. Later assertions in those cases are not claimed executed. This run establishes snapshot/direct-collection disagreement after re-addition. It does not establish which C10 component introduced it or a repair design.

## Non-fatal configuration diagnostic

Angular's Nx discovery and React's config loading report TSConfckParseError / EXTENDS_RESOLVE for archived `docs/audits/2026-10-17-incumbent-readiness/unknown-dynamic-access/review/tsconfig.json`, which extends missing `/private/tmp/st-unknown-access-candidate/tsconfig.typecheck-all.json`. Tasks continue into tests. This is a stale archived-fixture path diagnostic, not the cause established for the six assertion failures. No suppression or source repair performed.

## Skips

Angular: 281 passed / 3 skipped, 48 passing files / 1 skipped file. Source inspection identifies the opt-in `kernel-comparison.benchmark.spec.ts` RUN_TIMING suite. No skip/xfail was added by this verification.

Vue passed all 212 tests. Solid classification follows; all first logs remain preserved.

## Solid: actual behavioral failures

Full Solid run: 115 passed / 8 failed, 18 passing files / 1 failing file. Its target-level TypeScript precheck passed; the actual Solid Vitest runtime ran. All eight failures are in `packages/solid/src/lib/absent-collection.spec.ts`, each for both enhancer orders.

- Line 124: re-add through undoable addOne, whole-tree a.rows.all empty while direct row view contains Z.
- Line 173: collection-only root, whole-tree users.all empty while direct users view contains Z.
- Line 227: tap during whole-value write re-adds b; whole-tree b.rows.all empty while direct b row view contains Z. The wrote assertion preceding this passed.
- Line 274: transact re-add, whole-tree a.rows.all empty while direct row view contains Z.

First three re-add/undo/rollback labels do not establish later reversal failure: the first failed assertions precede those reversals. These are established promoted-suite value disagreements, not the separately preserved private-hook cases. Cause and correction are not adjudicated by this read-only verification.
