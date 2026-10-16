# Independent bounded implementation review

Checkout baseline: 8d220643e0d4e34cbdbc6e55e6ef692b25d5e023. In-progress source hashes: source-hashes.txt. Runtime/docs untouched by reviewer. Probe bundle generated from source using build.mjs; this is an isolated replay, not Nx suite evidence.

## Demonstrated blocker: stale scalar ownership after restoration

Public sequence: ordinary x=1; undoable x=2; undo -> x=1; transact x=3; rollback. Exact baseline returns x=1; integration returns x=2. Entity equivalent returns1 on both. No pending owner exists while undo runs; no injected fault. This revives the value explicitly undone and violates restoration/transaction composition.

Source boundary: sparse-adapter scalar seeds only on first capture and settles from its own committed root; restoration's scalar installation bypasses the terminal record capture in transactions.ts. Owning later x=3 therefore starts over stale committed2 instead of installed1.

Run: Node24.15 review/build.mjs; review/restoration.mjs. Baseline same probe with baseline bundle via build-baseline.mjs/restoration-baseline.mjs. Raw restoration-candidate.log/restoration-baseline.log. Initial attempted undo overlapping a still-pending owner correctly refused ST1034 and is not this finding.

## Scope limits / nonfindings

Inspection-authored y=9 inside a callback survived rollback of authored x=1 in an additional isolated probe (inspection.mjs); not a comprehensive inspection verdict. Existing unchanged recovery/inspection refusal tests in public-contracts-first.log have changed verdicts that may reflect overlap capability; raw failures are not automatically runtime defects. Native multi-plan install atomicity on throws and full Link/destruction/recovery coverage were source-inspected only, not established by this review. Adapter reclamation wiring was absent at initial read but is in progress; do not treat absence in that snapshot as a final candidate verdict. No performance runs or full suites conducted by reviewer.

## Final frozen candidate recheck

Reran the SAME restoration probe against `/private/tmp/st-sparse-integration-final` using `build-final.mjs` and `restoration-final.mjs`. Raw `restoration-final.log`: scalar afterUndo=1, afterReject=2; entity control afterUndo=1, afterReject=1. Ordinary-input blocker is unchanged. No edits to runtime or original probe assertions/workload.

Initial hashes: sparse-adapter `ac821b86ae00cc50ad4b038b8af9255f435ff48753319351bd6db5b225c93f2e`; transactions `1b08fb0f0dd21ce8f23709618f2b3a156ea3a36b9e7a677b8870397a6191fcc3`.
Final hashes: sparse-adapter `db52385aebf6e591c173ce0eab411eb1ed514dc210064734627d3d7a90d011f4`; transactions `debeae47e20e10da092d05820d00242c82320b30dfb28e26a11c74f3d498e4b2`. Verified against final-integration/files.json; actual digest output saved `source-hashes-final.txt`.

Scoped retention source inspection: final adapter now clears subject/native maps on destruction, releases its retirement observer, checks sparse obligation and restoration claims before reclaiming, and runs settlement reclamation after held membership delivery. No unsafe indiscriminate clearing demonstrated. Two limitations remain source-visible, not independently executed failures here: (1) any restoration enhancer bypasses adapter reclamation entirely, so eventual adapter-map cleanup depends on a handoff not present in this function; (2) failed reclamation has no persistent retry queue, unlike frozen R3's maintenancePending, and ordinary retirement loop aborts at its first exception. Do not infer R3 maintenance retry acceptance from this adapter. These do not supersede the executed ordinary restoration counterexample.
