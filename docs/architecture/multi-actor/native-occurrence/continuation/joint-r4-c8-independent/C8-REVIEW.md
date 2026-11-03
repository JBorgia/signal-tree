Independent focused C8 composition review — 2026-11-02

Disposition: the three finalizer-refusal failures are diagnostic-message differences for the tested triggers, with the previously blocked semantic assertions passing in isolated companions. No blocker demonstrated in the six conflict resolutions or two adopted-slot bindings. One private-observer snapshot-timing concern remains bounded below; it is not a demonstrated supported-observer/public API regression. This is not full qualification or activation.

Exact evidence

C8 manifest SHA256 3ad1adb2de2936e52baf2ca06d630babc858d4186c2c4fed48818639056b388a. All 3,031 listed files verified before copying; original and review copy still match after execution. See c8-identity.json and c8-post-run-identity.json. All COMPOSITION.json base/left/right hashes match their input manifests; the six three-way input sets match those hashes. c8-conflict-regions.txt contains the independently regenerated conflict regions. Read resolve.py, relevant cumulative FROM-C7a.patch hunks, and the final source around each resolution. No frozen source/test or root file changed.

Scope contracts are the previously read project AGENTS/contributor/review protocol. Exact frozen-source premises include lifecycle.ts:210: “Installed completion delivers readiness; sealing itself never calls subscribers.” materialize-markers.ts:795–797: “Construction-owned children invalidate membership before callback-capable completion; other callers own their existing publication boundary.” These are implementation contracts in the C8 manifest, not newly authorized product requirements.

Resolution assessment

- entity-signal.ts: union of PreparedPlacementEntries type import and incoming PublicationPreparation/error/prepared-structure imports. No competing runtime branch discarded by that conflict resolution. R4 membership capture/release mechanism retained.
- tree-scalar-slot-port.ts, tree-scalar-leaf-runtime.ts, native-tree-scalar-leaf-runtime.ts: union retains ConstructionAllocation and incoming preparation/completion contracts. In addition to textual resolution, both adoption closures bind the newly allocated LIVE slot to prepared.leaf (portable :223, native :402), before binding publication and attaching the detached leaf. This matches ordinary creation's source binding. The live scalar frame consults publicationSources in tree-scalar-slot-runtime.ts:222–225; omitting this binding can bypass the adopted leaf's publication preparer.
- lifecycle.ts: requirement retains retirementOwnWindowOnly provenance while joining both unfinishedRequirements and unactivatedRequirements (:186–187). Readiness now requires both preparation/horizon completion and activation. This does not derive retirement provenance from a later compacted proof.
- private.ts: inspection/ordinary record selection and enrollment are retained; completion carries native requirement as well as parts/enrollments (:231). completeMembership (:233–241) attempts all enrollment activations, clears enrollment ownership, attempts native readiness, then all scalar recipient completions, throwing the first captured error after draining. Enrollment activation precedes possible readiness reentry, so installed descendant writers are already enrolled.

Inspection-native qualification

Inspection prepares a native requirement but deliberately excludes its native.record and nativeMembers/nativeNegativeDomains writes from the installed record (:231). It installs physical-view/enrollment records; enrollment uses unavailableInput instead of that native requirement (:216), and the inspection branch creates no recipient parts (:218). Completion's readiness call may activate that ephemeral requirement outside a declaration; inside a declaration it can remain unfinished because it was never added to the installed horizon. Source inspection finds no installed ordinary requirement/recipient dependency on it. WeakSet membership alone does not retain it. This is a bounded ownership inference, not a universal retention proof.

Executable discrimination: inspection creation inside and outside an independent declaration produces no ordinary delivery; subsequent independent authoring of the adopted descendant produces only the authored path, reaches native readiness, and a second useful write also delivers. Both pass. No supported inspection-stall mechanism demonstrated.

Three unchanged failure adjudications

Original failures are preserved from Main, not rerun as broad suites: c8-main-c7a-controls-first.log (102 pass/2 fail) and c8-main-retirement-composition-first.log (23 pass/1 fail), with their exact COMMAND/RESULT artifacts. Expected messages contain “changed during finalization”; actual is “Entity publication source changed before installation”.

Cause: entity-publication.ts:242–256 now includes sourceRevision in shared validate(). finalize() calls it before and AFTER callback-capable finalizers. After reentrant installation changes revisionToken, that second validation throws before the older beforeFinalize comparison. Outer refusal remains before record installation; “during finalization” describes when the source changed, while “before installation” describes when the refusal occurs. The older diagnostic branch is shadowed for this source-revision mismatch.

Companions copy each original file under a new c8-review-* name and replace only that one expected message substring. c8-companions.patch proves all subsequent assertions are unchanged. Only the three implicated tests ran (3 pass, 19 deliberately unselected). The originals remain byte-identical to the frozen manifest.

- singleton-row-reuse.spec.ts:31–34: outer responsibility map stays empty, newer endpoint remains 99, escaped outer evidence identity remains intact.
- packet-index-review.spec.ts:27–30: outer install refuses, later native before endpoint remains 99.
- publication-retirement-boundaries.spec.ts:54–57: finalizer runs exactly once, reentrant row value remains 2.

For these exact triggers the semantic behavior survives; no public typed error-code contract was changed here (these are ordinary Error diagnostics). Recommend a narrow implementer disposition for the three message assertions, not a blanket relaxation of all refusal tests. No oracle was edited in frozen inputs.

Private readiness snapshot concern — open, not a supported-observer blocker demonstrated

Supported input: signalTree({rows:{}}), link to rows, then rows({a:{n:1}}). Private instrumentation spies on lifecycle.prepareNativeRequirement, attaches onNativeRequirementReady to the acquired membership requirement, reads the branch, and throws a sentinel on the first readiness callback.

Observed: private.ts:210 acquires the requirement. completeMembership private.ts:238 delivers it from installPreparedMember materialize-markers.ts:870, after publishMembershipChange(branch) at :867. At callback time rows() returns cached {}, while direct rows.a.n() is 1. After the throw leaves the operation, rows() returns {a:{n:1}}, the exact sentinel is preserved, link delivery is [{a:{n:1}}], and a later n(2) produces the next useful delivery. Stack/values are in c8-ready-trace.jsonl.

The original readiness-error test expected the aggregate snapshot to match installed state and failed at that assertion. c8-readiness-error-first.log and c8-composition-first-spec.ts preserve the first failure/spec. Subsequent trace probes retained the failing assertion. A separately named drain-only discriminator requires the live child value, same error identity, post-return snapshot, completed link delivery and useful next write; it passes. It does not erase the snapshot failure.

Mechanism boundary: physical child is installed and enrollment/recipient completion drain correctly; the discrepancy concerns cached aggregate observation during a privately attached readiness callback inside the enclosing invalidation group. The direct consumer API write is supported, but the callback is not an application-facing subscription. No existing supported observer was shown to expose this snapshot or lose state. Main can trace snapshot-authority.ts:69–74 (membership revision) and materializeSnapshotNode's createDerived cache against enclosing invalidation-group timing. Do not promote this to a public atomicity blocker without that missing connection; do not claim universal callback snapshot freshness either.

Independent execution, no broad duplicate suites

All calls use corepack pnpm nx test kernel --skip-nx-cache, Node 24.15.0 / pnpm 10.17.0 / local Nx 23.1.0 / Vitest 4.1.9, --maxWorkers=1. Exact commands are in c8-*-command.json and c8-run.py; logs and exit files are adjacent.

- c8-companions: 3 pass, 19 intentionally unselected; only message expectations differ in companion files.
- c8-composition: 4 pass: portable/native adopted live-slot publication (two useful frame commits each), inspection enrollment inside/outside declaration with two useful authored writes.
- c8-readiness-error: 1 failed snapshot-timing probe; 4 unselected. Trace and posterror runs reproduce that failure.
- c8-drain-only: 1 pass; 5 unselected. Distinct contract; original failure retained.

The first C8 companion invocation emits inherited tsconfig resolution diagnostics from an archived audit config while Nx constructs its graph; it still collects and executes the targeted tests and exits 0. The log is retained without suppressing diagnostics. No test result inferred from Main's other passing groups; no broad suites, release/build/budget gates or additional framework matrix run here. Added discriminator spec types were not separately checked.

Environment uses the isolated, rebased dependency copy documented in environment.json, with same pinned lockfile as root/C8 (5e1ccb86b533ff4241d8a6ae5ac32ee9a56c6e10a416a8d1be3322d0ba531239). Original stale dependency failure is retained in the R4 evidence. Frozen/shared inputs and root remain untouched. Retained production 87f6831f, B closure, activation/public API/budget authority unchanged.

Prepend follow-up: two single-test, unchanged predecessor checks were completed separately after composition review; both C0 and C7a reproduce the inherited event-shape failure. See the appended R4-REVIEW.md baseline evidence. This does not close that qualification item or alter its oracle.
