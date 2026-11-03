# Singleton ordinary-row version reuse — standalone C5 experiment

One runtime expression changes in experimental-publication/entity.ts:151: a singleton ordinary edit reuses its finalized prepared row for ordinary per-edit evidence. Empty/multi-edit behavior and the physical snapshot copy remain unchanged. No producer, admission ownership, proof, revision, scope, public API, publication timing or budget change. The existing singleton discriminator means exactly one admitted ordinary edit, not one unique subject.

Base: exact C5 manifest b38d1ddc2a326b0589abe910447af92362a80e5e438b20cec657573d2603d620. All2,986 base files reverified unchanged in the original C5. Standalone candidate changes one runtime file and adds two specs. SOURCE-SHA256.json SHA256 c2fd0a2e27a3a0e80601e2909d0b7ad4720d1bfca8ee1dda0053fea7503af9f0 identifies the result. Base runtime is preserved as BASE-entity.ts; runtime.patch and tests.patch are separate. Root HEAD628d302dadb082a48c58528651c9088234d0a777 and unrelated dirty files remained untouched.

## Before/after correctness

Before runtime edits: all13 new controls pass on exact C5. Baseline point gate fails at15,800; original log preserved. After the one-line change:83 controls pass across12 files, including all13 new controls and existing packet/admission/native/lifetime controls. Strict source types and unchanged spec-type ratchet pass. No fixture repairs or changed inherited assertions were required.

New semantic controls hold forEdit evidence before installation, across later writes and physical inspection, through retirement/restoration, and through actual owner confirmation/rollback. Exact restored endpoint identity wins over selected/proposed endpoints. Absent and present-undefined endpoints remain distinct. Same-subject multi-edit and repeated-reference cases retain distinct per-edit requirement snapshots after later writes. Recipient finalizer reentry refuses outer installation while keeping held outer facts; later-recipient preparation failure leaves no outer source/responsibility installation. Existing native-admission controls additionally exercise equal-value ownership handoff, inverse/netzero and foreign windows. These are finite controls, not full integration or universal lifetime proof.

Source argument: rowFields clones installed ordinary storage per preparation; singleton ordinary processing has no later edit that could mutate that new row. Recipients receive evidence accessors, not mutable row storage. Future preparations clone again; retirement removes outer map entries. Endpoint and requirement objects were already shared by the former shallow copy. The optimization changes only the otherwise redundant Map container. Multi-edit snapshots and physical-version separation remain literal copies.

## Actual constructor/copy work

Measurement is test-only Map-constructor interception in a separate synchronous populated workload. It wraps input iterators to count copied entries, restores the original constructor in finally, and independently calibrates two constructions/two entries. Seeding and assertions are outside the measured region. All200 updated rows and an untouched row are checked. No runtime instrumentation, CPU timing, heap-size inference or syntax-counter substitution.

| Row fields | Resident rows | Writes | Maps before → after | Copied entries before → after |
| --- | --- | --- | --- | --- |
| 2 | 2,000 | 200 | 5,200 → 5,000 | 2,000 → 1,600 |
| 2 | 20,000 | 200 | 5,200 → 5,000 | 2,000 → 1,600 |
| 32 | 2,000 | 200 | 5,200 → 5,000 | 32,000 → 25,600 |
| 32 | 20,000 | 200 | 5,200 → 5,000 | 32,000 → 25,600 |

The preregistered200-Map and200×width copied-entry reductions are exactly observed. Raw baseline/successor-allocation.jsonl and ALLOCATION-COMPARISON.json preserve results. These count actual Map constructors and entries in this workload, not all allocation bytes, peak heap, retained memory or CPU savings.

The original unmodified point gate falls from15,800 to15,400 and remains **red** against less-than2,000. Both populations agree; workload/control source is unchanged. Both first failure logs remain. No ceiling acceptance or change.

## Reproduction and disposition

run.py preserves pinned Node24.15.0/pnpm10.17.0, Nx environment, exact workloads and spec/source gates; baseline-commands.json and successor-commands.json record command arrays and exit statuses. Baseline was executed before applying runtime.patch, successor afterward in the isolated copy. The historical full structural-sequence failures are not included or reclassified. No loaded-machine timing comparisons performed.

Ready for independent exact-source/allocation review; not self-approved for integration. REVIEW-REQUEST.md scopes that review. This experiment neither activates the SDK/publication work nor absorbs sibling changes, and it does not resolve the remaining cost gate.
