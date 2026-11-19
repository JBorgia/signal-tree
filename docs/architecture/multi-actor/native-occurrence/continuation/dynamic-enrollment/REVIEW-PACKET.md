# Independent implementation review request

Frozen candidate and exact hashes: FREEZE.json. Baseline: PREDECESSOR-SNAPSHOT-C0.json and baseline/candidate. Read source.patch and tests.patch; use a fresh review copy. Do not edit this frozen source, C0, A/B or root. Main retains integration authority.

Question: Does the private dynamic-member enrollment preserve source identity, ordinary membership/payload authority, publication chronology and cleanup across successful partial installation, failure, reentry and disposal?

Inspect these boundaries independently:
- Prepared ancestry issued while parent exists but fresh child edge does not; cold occurrence capture remains unchanged.
- Native requirements and ordinary payload captured before installation; no address-only permission or later physical snapshot admission.
- Source/recipient preparation must leave no live registrations or readiness subscriptions on failure. Installed descendants must be registered before later user code can write them.
- Fresh inspection membership is physically present but ordinarily absent; direct descendant adoption must exclude unrelated inspected siblings.
- Captured completion after disposal must not resurrect binding. Omit/readd reuses retained identities without duplicate registrations.
- Observation inheritance moved from preinstall to installed path; abandoned child writes are a specific falsifier.
- Actual collection-producer inventory is separate. The archived attempt failed before establishing a native collection and is not collection qualification.

Raw unchanged baseline failures: runs/original-timeouts. New preregistered red: runs/preregistered-red. Failure leak: runs/occurrence-and-failure; subsequent correction: runs/failed-plan-observation. Current final gates: runs/freeze-focused, freeze-source-types, freeze-spec-types. Four occurrence failures reproduce unchanged in baseline/runs/occurrence-baseline. Full logs and source hashes retained; no author inference is a substitute for replay.
