# Independent native entity input discriminators

## Scope and identity

Test-only work; no runtime or architecture edits. New owned file:
`packages/kernel/src/lib/entity-native-input-independent.spec.ts` in integration
`/private/tmp/link-entity-obligation-integration`, with identical test-only copy in
predecessor `/private/tmp/link-terminal-obligation-scalar`.

Predecessor HEAD: `0135ef18567573fec627667fc58bc3e7819cc29e`.
Test SHA256: `f9a7e74cda5b81b478a37b0e259ac2947215b4905541638d19ca1abe4a7247f4`.
`PREREG.spec.ts` preserves the exact test before execution. `BEFORE.json` and
`AFTER.json` are identical, including all165 tracked kernel runtime source hashes,
HEAD, status, Node version and test hash. Integration has concurrent worker runtime
edits; none were tested by this predecessor run. Other agents' verdicts were not
used to derive these assertions.

## Oracle and limits

Membership contract392fcf46 requires native source-owned positive and negative
membership evidence independent of Link registration; its supplied-input table
includes absent lookups, exact enumeration domains including omitted members,
collection membership and native predicate arguments. It states: “Snapshot value
and descriptor must refer to the same supplied view/revision, captured before
invoking the updater.” The role contractdabd8880 states: “At a native supplied-input
boundary, a source revision's unsettled D becomes an input requirement of the
consumer.” Complete declarations still validate actual native lower bounds; they
do not erase known I(p). All owners here are pending at native input acquisition,
so the terminal-confirmed discharge rule does not alter these expected contradictions.

Every declaration binds a supported scalar output. Collection/root/row operations
only supply native callback arguments. No collection declaration API, automatic
getter tracking or saved application-value provenance is assumed. Root snapshot
uses the incumbent runtime `{rows:{all:Row[]}}` shape with a local type assertion,
following the existing audit-entity-boundaries construction-marker typing caveat.
No capture-only fresh reader substitutes for the actual callback argument.

The predicate cases publish a scalar from the actual supplied b argument and return
false for every row. Their oracle concerns evidence of supplied input even when
no source candidate is selected; it does not claim that an external predicate
getter is automatically tracked. I found no additional policy choice needed for
these bounded cases.

## Cases and first result

| Cases | Native fact exercised | First result |
| --- | --- | --- |
| Root snapshot removed a, no/live/disposed source connection, independent declaration (3) | Negative membership survives omission and does not depend on recipient enrollment | All fail: no after-callback contradiction |
| Same root snapshots, truthful dependent(p) declaration (3) | Hold then useful0 after p, while unrelated later q stays pending | All pass |
| Row updater receives `{id:a}` after pending replacement omitted n, independent (1) | Negative field input in real supplied row | Fails: no after-callback contradiction |
| Same omitted-field row, truthful dependent(p) (1) | Hold then useful0 after p | Pass |
| updateWhere/removeWhere supply changed b, reject all candidates, independent (2) | Native predicate input is relevant even without a source write | Both fail: no after-callback contradiction |
| Same nonselected predicate arguments, truthful dependent(p) (2) | Hold then useful7 after p | Both pass |

Each case asserts actual consumed snapshot/value, callback count or candidate order,
retained target value and unchanged pending source inspection before the disputed
oracle. Predicate cases assert zero selected candidates and unchanged source rows.
No sibling write adds incidental possible-owner uncertainty. Source enrollment
none/live/disposed uses exactly the same root operation and declaration.

Six positive controls do not independently prove producer evidence capture:
explicit dependent(p) already supplies a validation obligation. They establish a
nonvacuous useful-progress counterpart. Six negative failures are the discriminating
native-input results. The independent cases stop at the missing-contradiction
assertion (lines60,92,127); their later hold/settlement assertions did not execute.
No premature send is claimed from this run. These are predecessor unmigrated
entity gaps, not a verdict that the concurrent candidate regressed or recurred.

## Execution

Node24.15.0; package manager pnpm10.17.0 through corepack. Cwd:
`/private/tmp/link-terminal-obligation-scalar`.

```sh
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=entity-native-input-independent.spec.ts --skip-nx-cache
```

Raw `FIRST.log`:12 executed,6 passed,6 failed; Nx exit1. No assertions were changed
or rerun. No spec-types, integration candidate tests, broad suites, framework tests
or benchmarks were run by this review. The Nx slot was released to parent/worker.

These controls are ready for the frozen implementation review; they do not grant
candidate acceptance or broader integration authority.
