# Independent R2 validation review

**The original source-validity failures are corrected. Full phase acceptance remains blocked by an omitted membership-owned scalar preparation path.** No runtime edits or Vue oracle substitutions.

## Identity

Frozen manifest SHA256 `289e25b0aeb5ab0d936c81b7ba77bf6994929c1a081418f6c0f6996e8c198a99`; fresh copy in this directory. FREEZE artifacts and every manifest file verified before copying. VERIFICATION.json confirms unchanged author/copy manifest entries and byte-identical original two falsifiers. Only a new review spec was added outside that manifest. No R1 hypothetical Vue oracle changes carried forward.

## What is established

The exact original enrollment/disposal pair passes unchanged. The eight new author validation controls also pass: both source orders, enrollment/release/retirement, scalar enrollment, and a later foreign owner excluded without proof resampling/readiness delivery. Ten readiness/mixed-seal controls and eleven atomic/structural controls pass. Thus **31 existing controls pass** in independent execution.

Source inspection supports those results. PublicationPreparation holds separate operation-local seal and validation lists. Entity units capture source revision, recipient revision, retirement revision and disposal; scalar units capture the composed preparer identity. Selected, ordinary point and heterogeneous operations validate their registered units before stores. Grouped point units forward validation to their eventual combined source unit. Standalone owners validate locally. Validators do not resample proofs or activate readiness. This is a general correction for the participating producer paths, not a special case for the original two test names.

## Concrete remaining blocker: membership frame seals outside the joint phase

New admitted control: `candidate/packages/kernel/src/lib/joint-membership-seal-independent.spec.ts`. It compares identical scalar+collection point operations with and without an explicit scalar member-presence effect. Membership identity is established through ordinary branch omission/re-add and the existing plainBranchMembershipEffects capture path, matching the repository's membership fixtures. No invented source address or synthetic owner cell is supplied.

The collection's actual recipient preparation opens a foreign pending transaction. For the non-membership route, scalar and row requirements both include that owner, and the operation installs useful values1. For the membership route, before any stores, raw evidence is:

```
{"membership":true,"owner":4,"scalarOwners":[],"rowOwners":[4],"a":0,"row":0}
```

The assertion requiring scalar W to include that preparation-time owner fails. The exact owner number is run-local; the assertion compares runtime identity. **1positive passes / 1counterexample fails.** This proves inconsistent sealing within one prepared operation; it does not claim an observed external send or a new owner policy.

Causal source path:

1. `tree-realization-adapter.ts:1018–1021` prepares plain members **before creating** the operation's PublicationPreparation.
2. `plain-branch-membership.ts:1104–1107` prepares its own scalar frame without a publicationPhase. That frame therefore creates and seals a standalone phase immediately.
3. Sibling collections prepare at adapter:1022–1026 and can open the foreign owner after the scalar proof is sealed.
4. Joint seal at:1032 only seals the collection participants. Later validation cannot repair the already sealed scalar W, and must not resample it.

This is the existing membership producer omitted from the shared phase, not speculative additional requirements. The structural branch also prepares members separately at adapter:888; that parallel route is source inspection, not a second executed failure. The earlier finalization/sealing requirement already forbids this order.

Smallest correction: let plain-member preparation contribute its scalar units and validity checks to the same operation-owned phase; instantiate/own that phase before preparing any member or collection participant. Seal once after all participating preparers, and validate all captured source/recipe obligations before the first store. Preserve standalone membership ownership when no enclosing operation exists. Do not fix this by resealing during install or by only checking a particular callback/field.

## Evidence limits and preserved failures

`first.log` contains20 existing passing controls plus the new positive control and an initial membership setup failure (21pass/1fail). `structure.log` separately contains11pass. The initial fixture lacked a recorded member address; a second fixture still lacked the capture registration. Both setup sources/logs are preserved. Only `membership-admitted.log` establishes the proof-window defect (1pass/1fail). Original tests and runtime were never rewritten to obtain the result.

No fresh full framework/type replay is attributed to this review. R1 direct/epoch acceptance and the still-pending acquisition-scope decision remain separate. The original Vue oracles remain frozen and unchanged here. Main retains integration authority.
