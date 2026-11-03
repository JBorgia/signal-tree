# Explicit private handoff successor

Candidate: /private/tmp/st-native-explicit-handoff-successor/candidate
Predecessor: /private/tmp/st-native-invocation-successor/candidate (preserved unchanged).
Seam proposal: SEAM-PROPOSAL.md, recorded before runtime edits following the user-relayed independent source review. This is not independent execution acceptance.

## Implementation

applyEffect keeps existing target resolution/planner and dispatches selected field writes through a private writable-binding continuation. Portable and native projections retain before-read/write/after-read/intrinsic ordering. interceptLocationWrites wraps the selected continuation through the same interception chain; only its proceed closure holds selection, including when coalesce defers it. Public replaceLocation, callable setters, framework .set and public updateOne/replaceOne pass no selection. No SDK/public export signatures changed.

The projection writer passes the explicit selection into shared private update/replacement implementations. Row absence uses the same callable row replacement core with explicit payload. Source/lifetime/field checks run at the private row/field entry and shared mutation entry; own-presence/transformed-value validation remains and the active lifetime is rechecked after equality may run getters. Selected restoredFields still enters the existing prepared value/terminal publication path. No new planner, persistent root, authority index or structural integration.

Runtime calls to withFieldEndpointInvocation/claimFieldEndpointInvocation were removed. Their old unused implementation remains only so the original historical helper test can run byte-identically; this is explicit cleanup debt, not part of the new mechanism. Production references were checked by rg: definitions only outside specs.

## Preserved tests and first failure

All predecessor manifest files were reverified. All original spec files, including the original25, are unchanged. Main's three-case scope fixture is byte-identical to the root archived copy. New tests were written before runtime; PREREGISTERED.spec.ts preserves the initial two-case fixture.

First Nx run: 8pass/1fail. Original handoff4 and Main scope3 passed; direct registered-interceptor reentry passed. The initial coalesce control wrapped rollback outside its transaction context and hit the existing batching guard before delivery. first-runtime.log is preserved. The corrected control invokes coalesce(proceed) inside the already registered interceptor in the rollback context; assertions on exact selection, nested noninheritance and final value were retained. No runtime change disabled/bypassed that guard.

focused.log: 30pass (original25 + unchanged Main3 + new2). Afterwards added post-equality active-lifetime validation and a fake native carrier control proving a getter's nested write receives undefined selection while the outer continuation receives its exact selection, with before/write/after/intrinsic event order asserted. focused-final.log: 66pass, 11files. The extra suites cover native projection observability and batching/detachment; these are focused regression checks, not broad qualification.

## Commands and results

Node24.15.0/pnpm via corepack. Working directory is candidate; Nx uses NX_DAEMON=false NX_ISOLATE_PLUGINS=false, cache skipped.

Final runtime command:
corepack pnpm nx test kernel --skip-nx-cache native-admission-handoff.spec.ts native-invocation-handoff.spec.ts native-admission-segments.spec.ts collection-contributor-core.spec.ts native-authored-footprint.spec.ts main-invocation-scope.spec.ts native-explicit-handoff.spec.ts native-projection-observability.spec.ts batching.spec.ts batching-detachment.spec.ts

Source: corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json — exit0 (source-types-final.log).
Specs: node tools/check-spec-types.mjs — exit0 (spec-types-final.log); existing ratcheted baseline unchanged, no public type weakening. The new fixture uses a structurally typed fake ObservationAdapter and inferred native cell; no all-any fixture.

First Nx initialization also reported an archived audit tsconfig referring to an unavailable historical scratch path. It did not prevent execution; logs retain that warning. No historical config was changed.

## Review boundary

Main's old internal certificate counterexample now passes unchanged. This does not establish an outgoing endpoint leak before, nor general endpoint safety after. Exact getter, collection interceptor, registered location interceptor, absence/undefined, throwing interceptor and native-carrier ordering are exercised by the focused fixtures. Independent execution review should examine particular-continuation forwarding, intercepted/coalesced scheduling, transformed-value/lifetime checks and failure cleanup. Structural/plain-member endpoint production, demand capture/render, broader qualification and production activation remain gated. No acceptance is claimed from 66 passes.
