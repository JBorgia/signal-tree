# Decisions from the follow-through

The owner authorized completing the proposed work without routine check-ins.
The [protocol](PROTOCOL.md) fixes the work and evidence boundaries. These are
implementation selections; final qualification and artifact identities belong
in the completed report.

## V15: retain the small construction changes for memory

Select the empty enhancer/capability-plan shortcut plus lazy allocation of empty
capture-listener and position-lookup containers for qualification. The shortcut
applies only without enhancer declarations or an explicit capability request.
Each tree still owns its plan and namespace. Existing containers behave normally
after first use. No public capability, export, option or method is removed.

The first cohort used three independently identified builds: baseline, planning,
and planning plus lazy containers. Forty-two positive/negative controls and 280
CPU plus 280 separate forced-GC children passed. Seven profiles used neutral and
actual Angular-native carriers, including late leaf/root Links, held writers,
an unrelated delivering Link and configured transactions. Every useful write,
held snapshot, delivered value and settlement was checked. Tree/snapshot release
checks included positive pin/release controls.

At construction above the module-ready checkpoint, the combined neutral
candidate's paired median difference was -390,768 bytes for 256 tiny trees and
-217,816 bytes for 128 ordinary eight-field trees. Comparing the combined arm
with planning alone separates approximately 1,225 bytes per tree in those two
profiles. These are normalized whole-process differences, not a heap-snapshot
attribution or a universal per-tree size. The planning arm also changes fixed
post-helper process memory by roughly 50–56 KB; do not attribute that to each
tree. Configured transactions already demand much of the machinery and save less.

Timing is mixed. The first cohort's neutral ordinary and late-root whole CPU
results were adverse. A registered follow-up kept those results and ran 24
episode-count controls and 112 fresh children, each executing twelve complete
original useful store lifetimes. It separately retained cold, subsequent eleven,
and all-twelve measurements with seven matched rounds and adjacent A/A children.
The original whole-workload regressions did not recur consistently. Some
first-use, scheduler-drain and released-writer stages remained adverse, including
shifts beyond the observed A/A range. No blanket speedup or equivalence claim is
supported. These are repeated store lifetimes, not one indefinitely lived store.

The tradeoff is a repeatable memory reduction for a small compatible change and
60 additional gzip bytes in the neutral bare experimental fixture. Canonical
bundle ceilings and final application comparisons remain separate checks. The
owner's cost/feasibility instruction does not turn numerical failures into passes.

### Canonical delivered-size disposition

The fresh build of `4e791f32238fa7bdde480c5408a23dc4a4bca804`, source seal
`aba6872e95102a814a3930bb8040e0454ecde1c8e040ced6ddeba8c7269e450d`, reproduces
all 109 measured combined-candidate kernel payloads byte for byte. The canonical
[bundle-economics generator](../../../tools/optimization-sweep/bundle-economics.py)
measures these gzip bytes against unchanged ceilings:

| Fixture | Baseline | Selected | Increase | Ceiling | Selected excess |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bare production | 11,011 | 11,071 | 60 | 11,059.2 | 11.8 |
| Bare development | 13,159 | 13,222 | 63 | 13,209.6 | 12.4 |
| Entities production | 25,333 | 25,392 | 59 | 25,292.8 | 99.2 |
| Entities development | 28,273 | 28,339 | 66 | 28,160 | 179 |

Accept this identified candidate's byte cost under the owner's explicit direction
to weigh budgets against benefit and feasibility. The artifact/consumer checks
subsequently completed successfully. The reason is the demonstrated construction
memory saving in both neutral and Angular cohorts, a small compatible change,
and no added configuration or weakened behavior. Timing remains mixed; a CPU
improvement is not part of this justification. The tested method extraction
increased delivered size and is not an alternative saving.

This is a new candidate-specific disposition. The earlier unchanged-entity
exception does not cover the new bare failures or these new bytes. All four
numerical misses remain failures; no ceiling changes. This does not establish
that these sizes are irreducible or authorize a general allowance for future
growth. The separate passing/grown/restored budget control exits 0/1/0 and
restores exact bytes; a mutation failing against an already-red baseline alone
would not establish sensitivity.

## EntityMap: reject this internal method split

An isolated derived package extracted the actual `has`, `where` and `find`
implementations into a helper while preserving public methods, descriptors,
names, arity and property order. Four CRUD/query consumers produced identical
useful outputs. The CRUD fixture still emitted 543 helper bytes; its gzip size
grew from 25,666 to 25,852 bytes. The query fixture grew from 25,812 to 26,006.

This split buys no delivered-size saving with the complete returned API. Reject
it and keep production source unchanged. This does not prove every possible
internal decomposition is unhelpful, and does not justify breaking stable APIs.

## V16: prove the application boundary without expanding the kernel

The new reference uses the existing identified v16 runtime. The backend owns
authenticated accounts, tenant/destination authorization, exact review binding,
durable receipt deduplication and SQLite-owned effects. The application owns
command/native-owner correlation, navigation reconciliation and presentation.
Private Studio owns optional recording and investigation facilities.

Actual process kills before commit leave no effect; kills after commit but before
the response preserve the effect and original receipt through restart. Concurrent
duplicates, scoped reads/writes, independent review, revocation during an upload,
changed entity lifetime and ABA inputs have nonvacuous tests. Isolated bypass
controls must fail their actual effect-count assertions. This proves process
recovery for database-owned effects, not power-loss behavior or exactly-once
execution in arbitrary remote services.

Review-list responses are bounded independently of durable deduplication history.
The application retains unresolved operations omitted from a recent terminal
history page and reconciles them by exact ID. It serializes preparation/list
registration, keeps deliveries concurrent, refuses stale snapshot replacement,
and does not recreate a settled owner from an older review response.

Fixture-host credentials are real independent bearer authorities in this proof;
they are not a production identity-provider integration. Account names do not
prove a human approved a command. Agent labels remain declared attribution.
Durable receipt/review retention needs an application policy; silently evicting
deduplication records would weaken the demonstrated guarantee.

## Oversight clarity is part of correctness

An independent simulated investigator inspected only rendered screenshots and
visible text, without source or answer keys. It distinguished the five supplied
states but found misleading labels: local previews looked authoritative,
absent metadata looked like system attribution, zero counts were blank, and
recovery/retry consequences were unclear. The follow-up identifies local preview
and fetched server snapshot separately, uses explicit counts and unknown actors,
explains exact-command retries and local recovery, and shows evidence windows.

A second independent inspection confirmed the original counterexamples were
addressed and identified narrower wording corrections around browser-held export
scope, manual receipt lookup and snapshot age. These were corrected too. This is
simulated-agent evidence. The prepared real-human task kit remains unexecuted;
there are no fabricated participants or inferred human comprehension results.

## Evidence checker closure

The final source-byte gate passed its 20 existing classifier tests and then ran
out of memory scanning tracked historical `evidence.tar.gz.part-001` files as
text. Its existing binary classifier recognized `part01` only. The correction
accepts an optional hyphen before the required numeric suffix of known compressed
archives. Six additional cases cover both legitimate archives and source-like
names that must still reject NUL. The new archive cases fail against the old
checker; all 26 cases and the full tracked-source scan pass after the correction.
The initial OOM and red/green logs are preserved. This changes tooling
classification, not runtime behavior or a performance budget.
