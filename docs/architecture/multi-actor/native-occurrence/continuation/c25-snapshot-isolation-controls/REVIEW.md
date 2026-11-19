# Saved inspection snapshot isolation — prepared, not executed

One scenario with direct and whole-branch/frame return routes (two cases). Test-only packet based on frozen C24 source, not the in-progress C25 implementation. No runtime/config changes, test runs, type checks, or internal proof injection. Source files used for reasoning are copied and verified against SNAPSHOT-FROZEN.json in SOURCE-IDENTITY.json. Root HEAD is contextual only; the frozen manifest identifies runtime bytes.

## Reachability and oracle

`opaque-terminal-snapshot.spec.ts:36–50` already asserts that `leaf(payload)` preserves object identity through branch/root reads and an actual updater input. `leaf.ts:19–28` explicitly promises original-value identity. Thus a public holder `signalTree({input: leaf(saved)})` makes the saved object a real later updater argument. This is not a closure-only read, which would not establish native input capture.

`utils.ts` builds snapshots using terminal values directly and records the resulting branch certificate (line 554). `experimental-publication/private.ts:105–125` checks the supplied object's snapshot certificate before a terminal location's own view, recursively composing the holder certificate. `signal-tree.ts:485–490` begins branch input capture before invoking the updater. These source paths make the scenario reachable without injecting a certificate, native requirement, or branch-input stack. Runtime reachability is source-grounded, NOT demonstrated by execution. The identity assertions deliberately fail if a later implementation no longer supplies the exact saved object.

`entity-input-view-contract.spec.ts:13–37` establishes that consuming physical inspection 99 through a real updater cannot borrow ordinary support: independent declaration becomes conservative/unknown, sends nothing until the captured owner window settles, then sends exactly 99 with surviving basis. It also establishes that a newly opened unrelated owner after capture does not extend that window. Our foreign owner is deliberately opened BEFORE consumption; the restored ordinary 7 and both holders are established before that owner opens. `lifecycle.ts:152–188` distinguishes unavailable input and captures its fixed window at authorship. Fresh 7 provides a paired progress control through the SAME public holder/updater route while that owner remains pending.

The combined saved-object holder case is a NEW cross-contract discriminator, not an existing frozen test verbatim. Its specific certificate propagation is supported by source; no claim that arbitrary copied/deserialized snapshots or hidden closure values retain provenance. Only inspection installation uses the established private withWriteContext ingress. All subsequent snapshots, writes, holder construction/updaters, Link declaration, foreign transaction inspection/confirmation, settlement, and teardown use public operations. Local declaration typing follows the frozen experimental tests and adds no export.

## What a failure means

- An early saved-99 send, with holder identity assertions satisfied, falsifies saved physical-view isolation. The fresh-7 control must still progress; holding both is not success.
- An identity/setup/typing failure is fixture reachability evidence, not a runtime safety finding. Preserve it rather than changing assertions to hide it.
- The direct/frame comparison targets premise #4: ordinary unchanged can coexist with a physical 99-to-7 replacement. It does not assert that a genuinely changed ordinary successor inherits historical ownership (withdrawn E5).
- No expected-failure result is claimed. In particular the frozen implementation may expose the premise, but this packet has not run.

## Deferred command

After independent review and Main's execution authorization, in an isolated composed copy with pinned Node24.15.0/pnpm10.17.0:

`pnpm nx test kernel saved-inspection-snapshot-isolation --skip-nx-cache --maxWorkers=1`

Source/spec type checks remain required before composition. Drain uses the existing bounded microtask pattern; it does not introduce a private notifier or a new scheduling contract. No UI/native-framework timing claims.
