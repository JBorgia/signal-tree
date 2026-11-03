# Independent C18 composition/source check

**Bounded accept of assembly integrity and the stated discovery dispositions. No accidental runtime loss or new cross-component source conflict demonstrated. C18 remains unqualified: the actual mixed-rollback progress failure stays live.** No tests, typechecks or production mutations performed by this review; Main's joint replay is separate evidence.

## Verified inputs

Independently hashed every manifest entry in all four source trees:

| Input | Manifest SHA256 | Entries |
|---|---|---:|
| C16 base | 611f7da2665e91f3c53a8aceeb32a2b878324d4db86ced489c2785e898d8e537 | 3061 |
| Value-work left | e87715deeebe1392fb4d8996376b6cb2e2a9e9678d47e8dbcf864857560d8382 | 3062 |
| Whole qualification right | a95b716f10c7dc43efc0f60d13a31a947695affff153b376ba6232c6835a28e3 | 3066 |
| C18 | cdfdf039f8cac66c90de26ff47cec3850b5e33db00e4b5c335c51bc934facbee | 3065 |

Recomputed three-way union rather than trusting COMPOSITION.json. No conflicts. C18 differs from that union only in three declared routing paths: whole-late-getter.spec.ts, whole-mixed-trace.spec.ts, and the single extracted case in value-work-handoff.spec.ts. Every other manifest entry agrees. The only runtime changes relative to C16 are entity-signal.ts, experimental-publication/private.ts, and link.ts. C18 private.ts/link.ts are byte-identical to reviewed value-work; entity-signal.ts is byte-identical to incoming qualification. In particular, lifecycle hasDeclaration, observeRevision declared:false, and the reviewed finally error-precedence correction are not lost; lifecycle bytes were included in the full union verification.

No lint, budget, public export, test configuration, package target or selector policy edits were introduced by this composition. This checks identity, not universal behavioral independence.

## Exact archival transfer and live discovery

- research-only/whole-late-getter.spec.ts equals the incoming invalid ordinal no-new-throw oracle byte-for-byte (SHA c167e0dc7bbdf11dcacc3e8706839bca8f67c58bacf57258ba254c605ccd7f9d).
- research-only/whole-mixed-trace.spec.ts equals the incoming recording-only file byte-for-byte (SHA 88776d52e058cf176bfd1b524b6f93d4001874216b9a0a56236318684fc491a6). Its four tracing loops still have their original recording bodies; none have been promoted to useful green assertions.
- research-only/ORIGINAL-value-work-handoff.spec.ts equals the complete frozen 13-case file byte-for-byte. Concatenating C18's active handoff file and private-reduction-reentry.case.txt reconstructs that exact original byte stream. Thus all12 intended active controls remain unchanged and the stronger injected author-reentry success assertions are preserved exactly, not rewritten as refusals or expected failures.
- whole-bounded-qualification.spec.ts is wholly byte-identical to the incoming qualification. The ordinary `it('mixed whole refreshes only unowned support while actual owned field holds then rolls back', ...)` still performs q.rollback and asserts immediate exact [{id:'a',x:0,y:9}] delivery while foreign r remains pending. There is no skip/todo/fails/only annotation and no weakened assertion.

Static configured-glob discovery independently confirms whole-bounded-qualification and active value-work-handoff are included. The two archived spec files reside in C18/research-only, outside C18/candidate, so neither the kernel test root nor candidate-root discovery sees them. No additional exclude filter was added. Kernel Nx uses tools/run-core-vitest.mjs with packages/kernel as cwd; inspected package target and runner agree. This is source/static discovery evidence, not a fresh test-list or execution result.

Archive files retain original relative imports and are archival artifacts, not claimed directly runnable from research-only. To replay them, restore their original package-relative location in a disposable copy; the complete original handoff file and frozen manifests preserve that context. Routing does not turn any of these bodies green or excuse the live mixed-rollback assertion.

## Cross-component source check

The entity delta widens ordinary publication fields for whole footprints, using the existing authoredByStep/ordinaryPlan correspondence, while leaving physical fields/value effects and native endpoint selection untouched (entity-signal.ts:1587 onward). The handoff delta consumes completed selected payload/support and records work independently; it does not grant permission based on epoch. Its Link adoption and current-ticket allowed check remain the reviewed bytes. Nothing in this merge changes pending-owner selection or makes the producer cursor an escape from a hold.

The interaction that deserves actual combined execution is an entity whole/support-only revision reaching the shared handoff reducer while older value work is outstanding, especially mixed rollback and observer reentry. That is an integration falsifier, not a new source-demonstrated defect. The existing immediate mixed-rollback witness remains the concrete live red; the whole qualification report also preserves its preexisting explicit-field counterpart and confirmed-owner characterization. This review neither repairs it nor upgrades the whole arm to universal acceptance. Main's joint controls/types must supply their own completed raw evidence.

## Commands, artifacts and limits

Executed only:

```
python3 /private/tmp/st-parent-freshness-implementation-independent/c18-composition-review/audit.py > /private/tmp/st-parent-freshness-implementation-independent/c18-composition-review/audit.log
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-parent-freshness-implementation-independent/c18-composition-review/discovery.cjs > /private/tmp/st-parent-freshness-implementation-independent/c18-composition-review/discovery.log
```

AUDIT.json records manifests, exact exceptions and archival hashes. discovery.json records parsed include/exclude patterns and complete matched files. ASSEMBLY.md/COMPOSITION.json, manifest, and all four archival files are copied here for review preservation. First discovery attempt had a harness-only missing root fast-glob resolution; HARNESS-FIRST.txt and discovery-FIRST.cjs preserve it. Corrected to the already installed isolated .pnpm dependency; no configuration/source change.

No broad suite, focused runtime replay, live red rerun, typecheck or release verification. Root and frozen candidates untouched. This is assembly/source sign-off only; it does not overrule the outstanding mixed rollback progress blocker.
