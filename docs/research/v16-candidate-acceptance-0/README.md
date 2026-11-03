# V16 candidate acceptance verification

Current disposition (October 14, 2026): scoped verification and matched cost
characterization completed against `8d220643`. See [final results](RESULT.md),
[complete cost tables](COST-TABLES.md), and the sealed evidence archive. The
history below preserves the earlier failures and contemporaneous next steps.
No merge, push, tag or publication was performed.

Owner approved the recommended ceilings with “proceed with recommendations”
after the reduction audit and explicit proposal. This supersedes the earlier
budget refusal; it does not authorize publication, merging or performance
neutrality claims.

Runtime baseline for this verification: `4742ecbcf8af8e225a618ce6555d04dc35b216f4`;
evidence-only predecessor: `8342ec6b632169540cc0f76b4a0c6176d134a262`.

| Artifact | Measured | Approved ceiling |
| --- | ---: | ---: |
| Bare production gzip | 11.64 KiB | 11.75 KiB |
| Bare development gzip | 13.99 KiB | 14.10 KiB |
| Entity production gzip | 25.46 KiB | 25.60 KiB |
| Entity development gzip | 28.22 KiB | 28.40 KiB |
| Demo initial | 563.16 kB | 570 kB |

Measurements and exact commands are preserved in
[optional structural preparation](../optional-structural-preparation-0/README.md).
The demo warning ceiling remains 525 kB: only its error ceiling was approved.

The accepted cost supports responsibility capture, retained settlement authority,
coherent publication and preservation of callback-authored writes. It is not
attributed entirely to the latest patch: the older baseline already exceeded
previous ceilings. The reduction audit removed unused structural code and moved
optional target planners outside ordinary EntityMap output. Both planner splits
save 823 gzip bytes in the matched plain fixture; enhanced fixtures have their
own recorded costs. No semantics, diagnostics or assertions were removed to
obtain green. Required shared machinery remains a real production cost.

Next: freeze this budget-only candidate, complete the registry and mutation
proofs, rebuild after mutations, verify packed strict consumers and Angular AOT,
re-run semantic characterization, and assess complete-candidate runtime cost
against the original baseline. Preserve every first failure. Passing the new
size limits is owner cost acceptance, not correctness or release acceptance.

No release is authorized by this record. V14 and new architecture remain out of
scope. Earlier records retain their contemporaneous failed budgets and decisions.

## First complete registry result and bounded corrections

Candidate `ecf04878` completed 75/84 gates, 9 failed, 0 known-red, exit 1.
Five failures involved sandbox-denied Watchman/npm cache access; four exposed
maintenance defects: stale publication wording, missing existing-reader guidance,
XZ evidence classified as text, and incomplete committed dependency staging in
the history-ownership benchmark. All first outputs are retained externally in
`artifacts/v16-acceptance-20261014/gates-first.log`; later runs do not replace it.

The corrections change no runtime semantics. Reader guidance now states scope
and lifetime limits. The source scanner recognizes XZ alongside existing binary
formats; 13 real Git-inventory controls preserve rejection of NUL-bearing text,
including `.xz.ts`, and run in the normal registry. The benchmark bundles the
complete exact-HEAD kernel dependency graph rather than maintaining selected
imports and behavioral shims. Its six arms, assertions and decision-20 verdict
are unchanged. Original failure, passing smoke, dirty-source independence and
wrong-owner mutation failure were preserved and independently reviewed. Old and
new benchmark timings must not be pooled across compilation forms.

Four semantic characterizations against exact `19a5bd03` and `ecf04878` have
identical verdicts: 188 held, 68 violated, 168 unsupported, zero execution errors.
All 48 changed row traces concern diagnostic rekey path labels (destination to
source); common harness hashes match. This is nonregression evidence, not a
claim that the broad architectural laws all hold. These unresolved semantics
remain distinct from the focused capture/publication regression contracts.

## Frozen-install mutation proof repair

At `e4672b9e`, an isolated `pnpm install --frozen-lockfile` produced an installed
lock identical to the committed lock. The complete registry passed 84/84,
exit 0. Its complete mutation run then failed: 82/84 proven, one blind
(`declaration-docs`), one errored (`raw-signals`), zero unproven/vacuous,
exit 1. Source restoration was clean. These results supersede neither the first
75/84 run nor the later green ordinary registry; they are separate evidence.

The raw-signal mutation still targeted the `.set()` loop replaced by `81780c4e`.
It now skips only raw measured writes through the current `arm.write` dispatch;
warmup and sentinel remain intact. The declaration mutation stripped the root
barrel, leaving 209 unique shipped documentation blocks above the unchanged
168 floor. Stripping the shared declaration chunk leaves 116 and fails for the
intended kernel STRIPPED diagnostic. Its build-hashed filename is resolved
lazily, requiring exactly one match. Checker thresholds and runtime code are
unchanged. This proves aggregate documentation preservation, not per-symbol
coverage of every barrel comment.

Both repairs were independently reviewed. Direct clean/mutated/restored runs
returned 0/1/0 with the expected diagnostics; the focused registry reported
2/2 proven, zero blind/errored/unproven/vacuous. First logs and reviews remain in
`artifacts/v16-acceptance-20261014/`. A mistakenly spaced `--only raw-signals`
invocation ran the full self-test instead of a focused run; its 83/84 result is
also retained. Focused selection requires `--only=raw-signals,declaration-docs`.
The new verification-only commit requires renewed full checks before final
artifacts and matched costs are qualified.

## Browser artifact budget reconciliation

At `c1714eae`, frozen-dependency full gates passed 84/84 and full mutation proofs
passed 84/84 (12 indirect), with zero unproven, vacuous, blind or errored checks.
Fresh post-mutation packages, strict consumers and Angular AOT passed. Browser
smoke then failed 135/136 solely because its separate hardcoded main-file bound
was 525,000 bytes; main measured 537,472 and total initial measured 563.16 kB.

History `1b05a123` introduced that main-size proxy alongside initial warning
525 kB/error 550 kB without a separate main-budget rationale. Independent review
supported reconciling the secondary proxy with the owner's approved initial
error policy. The browser test now reads that configured error ceiling (570 kB),
while the production build remains authoritative for the total initial graph.
Main-file size is explicitly not a substitute for aggregate measurement. The
525 kB warning, single-main/no-polyfill checks, and recursive ECharts/zrender and
Redux-devtools exclusions are unchanged. Another branch's historical 600 kB
proxy was inspected but not adopted or treated as authority.

The full browser suite passed 136/136. A temporary 40,005-byte main-file padding
mutation failed at 577,477 > 570,000, then byte-for-byte restoration passed.
Both the original browser failure and these controls remain in the external
acceptance evidence. No runtime or public-contract changes were made.
