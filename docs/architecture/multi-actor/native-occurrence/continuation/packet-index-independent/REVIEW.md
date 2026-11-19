# Packet-index independent implementation review

Disposition: **do not accept unchanged**. The finite batch allocation reduction is reproduced, but the proposed private admission guard has an uncovered finalization path and point-work costs regress. No runtime repair or patch combination was performed.

## Exact reviewed identity

Author candidate `/private/tmp/st-packet-index-successor/candidate`, copied into this directory before review execution. Independently verified all 2,968 source-manifest entries in both copies before/after primary replays. Final author FREEZE arrived during review; every listed hash matched and runtime/source identity remained unchanged.

- Source manifest SHA-256 `5688501724309578e31b18cad1e67d37d775e3f679611ef631339ac88e5354e0`.
- Runtime patch SHA-256 `90590972fc3bea5d944af55f275bfcbb01413d521d4a4b127f9f977a38ec4472`.
- `experimental-publication/entity.ts` SHA-256 `a253c0b4793919a15cf5d7849576fc086ed32f60fdec654ec28486e72e2e6091`.
- B manifest SHA-256 `6630a74c965b1f414eae5105c3eb3bb3ea09ba9b89f57f81149eee52086af1fd`; all 2,967 baseline-copy entries verified.

Author report was unavailable initially; a Main status request was recorded in REPORT-STATUS-REQUEST.md. It resolved when the final report appeared; source/raw review and the new failing probe preceded reading that report. No external review CLI, author edits, root edits or combined patches.

## Concrete findings

### 1. Admission guard stops before the last callback-capable finalizer

`candidate/packages/kernel/src/lib/experimental-publication/entity.ts:219–222` validates before/after the native finalizer. `internals/entity-publication.ts:168–188` places the native unit first and then invokes every recipient finalizer. The post-loop checks at 189–191 cover disposal/revision/recipient changes, not packet structure. A later recipient finalizer can append an admitted edit after the last structure check, and the prepared native/responsibility records still install.

Independent unchanged falsifier: `candidate/packages/kernel/src/lib/packet-index-review.spec.ts:6`, raw `independent-first.log`. Expected refusal before install fails. Its separate diagnostic confirms packet values become `[7,99]` while the responsibility record and native endpoint install 7. Final four-case file retains this assertion: **3 pass / 1 fail**, `independent-final.log`.

This contradicts the author's claim that private recipients cannot change admission structure and then install a stale prepared record. It is a concrete private-seam coverage failure, **not a demonstrated public API exploit or newly proven production payload regression**. Existing revision protection correctly rejects actual source reentry in a later finalizer; the new control confirms the newer endpoint remains 99. Packet-array mutation does not advance that source revision.

Required integration gate: retain the refusal assertion and ensure the admission-stability boundary spans all callback-capable preparation/finalization before installation, or explicitly adjudicate a narrower boundary rather than claiming this path is protected. Do not add a blanket deep-freeze of payloads/requirements. This review makes no runtime change.

### 2. Unchanged point-work gate regresses

Candidate unchanged `entity-granular-reactivity.spec.ts:213–215` reproduces **27,600** counted visits for 200 updates; equality between 2,000 and 20,000 rows passes, `<2000` fails. `point-candidate.log`. Independent uninstrumented B replay reproduces **14,400** visits and the same failing ceiling (`point-baseline.log`). Thus this candidate adds 13,200 counted visits (about 92%) for the unchanged workload. Guard/index work is real overhead, not free storage. Batch improvement does not qualify this existing gate or authorize raising its ceiling.

### 3. Instrumented identity file contains a stale intermediate hash

`allocation-final/IDENTITY.json` lists optimized instrumented entity hash `af8017...`, before `instrument-guard.py`; actual final file hashes to `43d0d9112c30870348e149caf907a5d846a90df7f8e21667d2bc9e280b00f7fa`. VERIFICATION.json correctly names the latter. This does not invalidate replay, but consumers must use the final verification identity or the intermediate file must be labeled. No author artifact was changed.

## Equivalence and scope assessment

For source-issued stable numeric subject identities, Map last-write selection matches reverse/find's last matching edit. Full sequence iteration remains intact, so the lookup does not coalesce edits, reorder steps, or replace per-edit identity. Same-step authoredRemoval dedup remains in the original helper; ordinals do not define sequence order. Restored endpoint > explicitly selected endpoint > last proposal precedence remains in `chosen`. Added independent repeated *same step and same edit object* control compares the original reverse/find oracle, confirms the last original object, and verifies restored endpoint identity; it passes. Author duplicate/tombstone/rekey/empty-step/deferred-aggregation controls also pass.

The guard checks array reference/order/membership, step identity and authoredRemoval reference, edit subject, structural reference/kind. It does not assert general packet immutability: field lists, payloads, restoredFields contents, order arrays, metadata and proof cells are not frozen or deeply snapshotted. The author now acknowledges the payload/reference limits. The finalizer gap above still contradicts the stronger admission claim. No new counterexample involving legitimate producer mutation was found in this bounded read; entity-signal.ts:2338 supplies source-owned packet structure and selection-based responsibility.

Native support now captures admitted subject identity while retaining source/proof objects. This is an intentional private post-install mutation behavior change, not complete equivalence for mutable private packets. No global cache, observer bypass or source-native proof downgrade is introduced by this patch.

## Independent replay evidence

- Original focused semantic selection: **56 pass / 3 fail**, `semantic-replay.log`; all 24 author adversarial cases pass within it. Reds are the three unchanged structural-sequence cases: remove→rekey vacancy, removal before physical omission, numeric/string keys. Independent uninstrumented B replay reproduces those same three failures (5 pass / 3 fail in that file); no oracle waiver.
- Added independent cases: **3 pass / 1 fail**, `independent-final.log`; initial two-case exact first red retained in `independent-first.log`.
- Allocation B and optimized: **10 pass each**, `baseline-allocation.log`, `optimized-allocation.log`. Each produces nine records; full JSON records exactly equal the author's corresponding records. Original fixture hash `5239ef4962bb110b4e622cc0d0193e5666785f8bec8cf40e3b9d32ab4f1183c7` is unchanged in both copies. All retention phase dictionaries match between arms. See `REPLAY-VERIFICATION.json`.
- Source typecheck exits 0; ratcheted spec-types exits 0 including added independent fixture. `source-types.log`, `spec-types.log`; no baseline changes, not a clean-whole-spec-tree claim.

At N=32/128/1024, baseline counted array entries are 4,128/65,664/4,195,328; successor 322/1,282/10,242. Measured Map constructors increase by two. New guard/index Map constructors and added array-copy sites are instrumented; their costs have not been hidden from these counters. Original proposal copies disappear and flatMap runs once. However this is **named construction-site accounting**, not total work/heap: validation scans, callback accesses, other allocations, and unchanged physical `.find` pairing remain. No CPU, OOM, global complexity or universal retention acceptance follows.

The independent finalizer refusal also fails unchanged on B, while the diagnostic, repeated-identity, and source-reentry cases pass: `baseline-semantic.log` totals **8 pass / 4 fail** across the original eight and new four cases. Thus finding 1 is an unclosed new guard claim over an inherited private mutation hole, not an attributed new public regression.

## Commands

Node `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin` first on PATH, pnpm10.17.0, `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Candidate cwd is this directory's `candidate`:

```sh
corepack pnpm nx test kernel --skip-nx-cache packet-index-adversarial.spec.ts native-admission-handoff.spec.ts native-invocation-handoff.spec.ts structural-admission-controls.spec.ts structural-admission-sequence.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-acceptance.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache packet-index-review.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern='a single-entity update does not rebuild' --maxWorkers=1
corepack pnpm run typecheck:source
node tools/check-spec-types.mjs
```

Allocation replay cwd `baseline-b` and `optimized` (fresh copies of the exact instrumented trees): `ST_ALLOCATION_OUTPUT=/private/tmp/st-packet-index-independent/<arm>.jsonl corepack pnpm nx test kernel --skip-nx-cache allocation-diagnostic.spec.ts --maxWorkers=1`. Use a new JSONL filename for another replay; append output must not be conflated.

Uninstrumented `baseline-semantic` is a fresh B copy with only the independent fixture added: same point-work command, then `corepack pnpm nx test kernel --skip-nx-cache structural-admission-sequence.spec.ts packet-index-review.spec.ts --maxWorkers=1`.

Main retains acceptance authority. This review does not approve a guard policy change, relax any existing failure, or qualify a combined candidate.
