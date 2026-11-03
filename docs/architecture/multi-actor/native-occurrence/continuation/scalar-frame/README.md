# Frozen scalar-frame publication successor — independent review handoff

Candidate: `/private/tmp/st-scalar-frame-publication-successor/candidate`. Frozen for review, **not accepted, activated or released**. Main/root and the frozen combined predecessor were not edited. No new public SDK, package export, public type weakening, framework-private API, dependency installation or external CLI source transfer.

## Identities and artifacts

- Verified/copy-verified predecessor: `/private/tmp/st-native-combined-successor/candidate`, all 2963 `SNAPSHOT-A.json` files. Manifest SHA256 `b226c1d39c85e49265446b2bf83d3e5bdb64c2dae1ade93a466baceac1641e0a`.
- Frozen successor: 2970 files, 24 changed/added files: **18 runtime, 6 test**. Manifest SHA256 `e9b1555e1c2f49f1dfd5b26aa56cae20b22afa9d8d386c32f32091d46a8590a6`.
- `source.patch`: `c8e2819a9f36333533ccd3631f4411282882c87ce35ef33232c002d93c5790a7`.
- `tests.patch`: `b6824c397f9b70275c0e3db879e59bf9f28c0b7c29a3e1ae25812a19da3a1fa4`.
- `candidate-source.tar.gz`: `6cd015eada89c04520df59ff21ec9c7af5f0a8cc8802d4ecf5288f9284bfa955`; all 2970 archived bytes rehashed against the manifest. Dependencies/build output excluded.
- `FREEZE.json`, `CHANGED-SHA256.json`, `COPY-VERIFIED.json`, `FINAL-COMMAND-RESULTS.json` identify exact inputs, changes and commands. The scratch archive has no Git metadata; no branch, commit or shared-history change was made.
- `git apply --check ../source.patch ../tests.patch` passes in the isolated `patch-check` copy. The first command used an absolute `--directory` and Git rejected its path; both outcomes are recorded in `PATCH-CHECK.json`.

## Mechanism implemented

1. The shared scalar substrate binds each slot to its actual intrinsic source. Its final frame prepares ordinary-before/after, equality/inspection-shadow work and native/recipient records before stores. Existing primitive records install alongside scalar truth. Preparation failure/reentry installs no outer frame.
2. Sibling preparers use an operation-local predecessor map. This prevents an equal final sibling from collapsing past an earlier changed sibling prepared in the same frame. Nested direct writes do not inherit that map.
3. An explicit frame publication object owns installed completions separately from changedSlots. Native and neutral publication drain captured completion parts even after invalidation error; consumption precedes callbacks. Unregister cannot lose a captured obligation. `publish:false` transfers ownership; plain-member result reconstruction preserves it. Synthetic `member-membership` invalidation carries no obligation and cannot consume another frame.
4. Restoration and heterogeneous realization prepare scalar installers before outer installation. Transaction, restoration, and legacy member+scalar routes feed the final combined member/scalar frame instead of preparing a second frame whose equality was computed against stale values. Restoration preparation retains its existing restoration origin. Missing internal prepare capability refuses before stores; no public adapter classification changes.
5. Each direct scalar mutation and frame notification carries the recipients that actually prepared that contribution. Both owned emitters and interception paths forward the receipt. Coverage is participation, never permission; there is no binding/current-projection blanket guard.
6. The private projection subscriber view retains individual notification payloads, coverage and enqueue revision through coalescence. Generic subscribers keep existing coalesced metadata/callback behavior. Persistent concatenation avoids copying an entire contribution prefix per write; traversal is iterative and queued lifetime only.
7. Uncovered scalar observations use their own payload. A later **installed scalar fact for the exact source field**, not a sibling/aggregate revision, supersedes an older observation. Incomplete native units retain uncovered observations until reduction; the base comes from completed recipient state, never a physical reread. Existing conservative unknown fallback remains unknown. Aggregate fallback applies completed membership masking. Disposal drops queued observations.

This is a private source/notification integration correction. It does not fix possible-owner-window capture or new-descendant enrollment/completion. Main's separate B/structural patch was not incorporated. Composition into B requires review of overlapping restoration, transaction, target-transition, plain-member and realization-adapter hunks.

## Executed gates on the exact freeze

All eight final runs match all 2970 frozen file hashes in `SOURCE-BEFORE.json`; each `SOURCE-AFTER.json` reports unchanged source. Every run directory has exact cwd/argv/environment, first.log, exit/elapsed result, and before/after identities.

| Run under `runs/` | Observed result |
| --- | --- |
| `final-focused-kernel` | **220 passed**, 13 files |
| `final-angular` | **28 passed**, new two plus unchanged transaction-realization |
| `final-vue` | **28 passed**, same scope |
| `final-solid` | **28 passed**, same scope |
| `final-react` | **28 passed**, same scope; correct `.spec.tsx` filename |
| `final-source-types` | exit 0, source tsc |
| `final-spec-types` | exit 0, canonical spec-type gate; no baseline change |
| `final-required-diagnostics` | **8 failed / 34 passed**, exact reds below |

The kernel gate includes unchanged branch/oracle/A1, membership-input/provenance, terminal-consumer, native-address, scalar substrate, reversal-delivery, target-transition and restoration-paired-composition suites, plus new frame/finalization controls. No broad full suite, ceiling, release or peer-version qualification was run.

The two original branch failures pass unchanged on the freeze. Five mandatory unchanged specs—branch-omission, oracle-alignment, A1, enrollment-invariance, whole-value-new-keys—still match predecessor hashes exactly.

## Remaining diagnostic reds — not attributed to this mechanism

- Six enrollment cases: branch/root × before-pending, during-pending, enroll-in-updater. `baseline-enrollment` independently reproduced **6 failed / 30 passed** on verified A before runtime edits. Final diagnostic retains those six. Main reports a separate possible-owner-window correction in progress; that correction is not included here.
- `whole-value-new-keys`: “keeps a pre-existing Link observing newly supplied descendants” and “delivers completed partial membership to Link when a later value throws” still time out at 5000 ms. These were supplied as pre-existing by Main and reproduced here after scalar repair (`contributions-first`, then final diagnostics); no claim of a new independent prepatch replay of these two.
- Archived tsconfig references to `/private/tmp/st-unknown-access-candidate` produce existing resolution warnings in some Nx runs. They did not prevent the listed passing gates.

## Preregistered matrix and actual limits

`TEST-PLAN.md` was written before runtime edits. New executable controls cover native+neutral preparer failure, equality failure, reentry preserving nested truth, source-finalizer failure before stores, sibling composition, delayed publication transfer, completion unregister/reentry/replay, throwing invalidation/completion and later recovery, real declarative-restoration preparation refusal, mixed scalar/member/row compensation, inspection/equal-physical adoption, disposal before completion, same-position separate trees, and actual facade branch egress.

Mixed covered/uncovered tests intentionally use **synthetic internal notifier contributions** to test protocol handling, including both orders, an unrelated sibling, absent metadata, later omission, and pending frame completion. They do not establish that a new public custom-adapter write route is supported. No concrete public admitted uninstrumented scalar writer was established in this bounded task; optional source attachment/fallback compatibility remains a source-inspection claim for independent review. Native-only public writes and the unchanged public regressions execute through actual source units.

The isolated finalizer fixture registers a native participant in its own test module; it does not replace production publication authority. Native fake ordering tests are supplemented by actual Angular/Vue/Solid/React runs. No universal framework-peer, retention/GC, mutation-testing or performance claim follows from these tests.

## Preserved first failures

- `baseline-branch`: exact **2 failed / 42 passed** before runtime edits.
- `baseline-enrollment`: exact **6 failed / 30 passed** before runtime edits.
- `frame-first`: missing rollback contribution corrected; stale same-turn notification still fails (**1 failed / 43 passed**).
- `sibling-first`: changed sibling followed by equal sibling loses output (**1 failed / 16 passed**); predecessor composition correction then passes.
- `mixed-protocol-first`: uncovered-last and unrelated sibling lost while native reduction was pending. A later attempt exposed the missing owned-emitter forwarding route; its A1/oracle regressions are preserved in `mixed-protocol-corrected`. Fixes were validated against unchanged A1/oracles, not by changing them.
- First handoff probe expected a generic notifier callback for net ABA; existing notifier intentionally suppresses it. Original mismatch remains; the corrected probe includes a subsequent distinct value while preserving ABA in the contribution history. The private projection-view assertion was subsequently corrected to subscribe to that view, preserving ordinary subscriber behavior.
- First source/spec typing failures and React's initially excluded `.spec.ts` filename are preserved. The first React 26-test pass was only unchanged transaction-realization, not execution of the new tests.

All first logs and input hashes remain under `runs/`; original A is preserved at the supplied frozen source. Intermediate input hashes identify each attempt; they are not claimed to be separate full source archives. Final source/test patches and complete tar archive are provided.

## Reproduction and independent review

Use `python3 /private/tmp/st-scalar-frame-publication-successor/run-gate.py NEW-NAME ...`; names must be fresh. The runner pins Node 24.15.0, uses installed corepack/pnpm through Nx, sets NX_DAEMON=false/NX_ISOLATE_PLUGINS=false/NX_TUI=false, and creates a fresh ST_PREPARED_REVIEW_OUTPUT directory.

Exact argument vectors for all final tests/types are in `FINAL-COMMAND-RESULTS.json`; the complete invocation/environment is in each `runs/NAME/COMMAND.json`. Source/spec tests were run via canonical tools, not bare root Vitest.

Independent review should inspect actual scalar-record/ordinary-value installation ordering, callback error closure, sibling predecessor composition, source-specific revision filtering and mixed notification handling. In particular, assess the interpretation boundary for synthetic uncovered contributions separately from public source coverage. This document supplies author results, not a peer verdict or bounded acceptance. Do not apply this A-based patch blindly over Main's B.
