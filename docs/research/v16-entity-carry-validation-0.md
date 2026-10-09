# V16 entity carry: requirements and first-red evidence

Base: `21143965a0d31327b4c5dba2378b5c52cf193dd5`, isolated
`codex/v16-runtime-recovery`. This record describes work in progress, not a
verified release candidate. Main and the original research checkout are preserved.

## Requirements checked against actual behavior

- An overwrite retains the existing entity lifetime and reports its actual
  previous value. Calling it a fresh structural add made reversal delete the row.
- A fresh upsert reports membership creation, including its predecessor; a bare
  value change cannot support reversal of that creation.
- Prepending must record final order. The v15 temporary shared collector was not
  copied: metadata already copied or flushed by a callback cannot be backpatched.
  A private common add path establishes prepend order before path/tap delivery,
  and records surviving-row order changes. Explicit prepend mutator observation
  replaces reliance on its nested public addMany call. Taps now see final prepend
  topology; this observable timing change is intentional and requires reentry
  controls, not an assertion of behavior-neutral extraction.
- Replay taps report applied lifecycle changes through the existing v16 tap
  machinery. Update `changes` may be partial or a full row; the last argument is
  the resulting entity. Historical broader wording was contradicted by execution
  and corrected without changing compatible payload behavior.
- A deterministic derived-caching assertion does not belong behind a timing
  benchmark flag. It now runs normally. The two timing tests remain opt-in;
  their thresholds were not changed or claimed freshly measured.

No public export, new transaction semantics or compatibility policy is introduced.
Frozen semantic laws were not rewritten to match the incumbent.

## Executed evidence

The three frozen duplicate/interceptor/tap files have 166 cases. Only expected-
failed runner markers were temporarily removed; assertions were unchanged and
original bytes restored after each diagnostic. Every transition was matched by
full test name, retaining original failures and all control results.

| Implementation stage | Pass | Fail |
| --- | ---: | ---: |
| Original | 119 | 47 |
| Correct overwrite facts | 131 | 35 |
| Correct fresh-upsert facts | 155 | 11 |
| Replay lifecycle taps | 157 | 9 |
| Final prepend order | 166 | 0 |

The 47 repaired cases are now ordinary conformance tests. The duplicate files
also passed through normal Nx registration: 153/153.

Additional original v15 carriers, adapted only from `transaction` to `transact`:

| Carrier | First run | After bounded repair |
| --- | --- | --- |
| addMany overwrite | 30 fail / 18 pass | 48 pass |
| fresh upsertMany | 18 fail | 18 pass |
| replay taps | 34 fail / 15 pass | 49 pass |
| prepend order | 24 fail / 33 pass | 57 pass |

Eight independently prepared replay payload/reentry/disposal controls pass through
Nx. Four copied-source tap mutants are killed by the unchanged 49-case carrier.
Source review of overwrite/upsert found no scoped defect; this is not universal
reentry or opaque-value proof.

## Open composition evidence

Expanded historical carriers reveal additional missing lifetime/order/presence
planning, not failures erased by the 166-case result:

- update then remove: first run 45 fail / 63 pass;
- overwrite composition hardening: first run 30 fail / 68 pass;
- historical limitations: first run 21 fail / 3 pass / 6 expected failures.

The limitation log mixes real desired-state failures with obsolete exact refusal
message expectations. Preserve error causes and unchanged-state assertions;
do not restore old wording or count atomic refusal as successful reversal.
Planner carries must retain v16's indexed lookup, member-presence addresses,
inspection and recovery contracts. They are not implemented by the publication
fixes described above.

The current A–D source carry has now run through the full kernel target:
5,459 registrations, 5,360 passed, 87 failed and 12 skipped, exit 1. Passed
registrations include remaining expected-failure tests and are not all positive
conformance proofs. All 87 failures are in the three expanded planner carriers:
21 overwrite-hardening, 21 historical-limitations and 45 update/remove. Every
one of the original 166 diagnostic names passes as an ordinary assertion.

All four framework targets exit 0: Angular 218 passed / 3 skipped, React 55,
Vue 113 and Solid 83 passed. Source typecheck, spec-types and final kernel lint
exit 0. The first lint run failed on 14 empty callback bodies in the new prepend
fixture; explicit shared no-op bodies corrected that fixture without changing
assertions. Both independent boundary supplements pass through Nx (12 prepend,
8 replay). All five packages built successfully. The three selected README/API
and declaration documentation gates report 3/3 passed.

Fresh built size remains red: entity production 25.57 KiB against 22.60, entity
development 28.36 against 25.25; the budget command exits 1. Bare-tree production
11.21 / development 13.54 KiB is unchanged. The production demo exits 1 at
555.46 decimal kB against its 550 kB initial ceiling (21143965 measured 554.79).
No ceiling was raised. The budget failure guidance now calls for measured graph
attribution instead of assuming every overage proves optional-module leakage.

These runs qualify neither a release nor the separately recorded inline
publication/compensation boundary. The planner repair, complete semantic-matrix
reconciliation, performance and packed-consumer verification remain open.

## Reproduction and identity

Use Node24.15.0, pinned pnpm10.17.0 and the kernel Nx target, e.g.
`pnpm nx test kernel --testFile=prepend-many-order-reversal`.
Raw first/after logs are `/private/tmp/st-v16-*-first.log` and the matching
`*-after.log`; all 166 named verdicts, source/test hashes and restoration records
are under `/private/tmp/st-v16-carry-first-red/`.
Independent source/callback controls are in `/private/tmp/st-v16-*-independent/`,
`/private/tmp/st-v16-prepend-c-controls/` and `/private/tmp/st-v16-carry-premise/`.
The parent ignored evidence index lives under
`artifacts/v16-research-2026-10-09/` in the main checkout. Those files are evidence
for these runs, not automatically current release claims.
