# Exact C11 test-only reconciliation — independent review pending

Prepared three-file test-only patch `TESTS.patch` and matching `overlay/`. Nine of the ten classified failures reconcile. Occupancy remains unchanged and red. No runtime, publicsurface, export, baseline or production activation change. This packet is concrete and locally checked, but MUST NOT be described as having completed the requested second independent review.

Input: `/private/tmp/st-native-combined-c11/SNAPSHOT-COUNTERPARTS.json`, SHA256 `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`, 3045 entries. `original/` and `candidate/` were independently populated from that manifest, with no earlier diagnostic specs copied in. Dependencies point only to our previously isolated dependency copy. `SNAPSHOT-C11-INPUT.json`, `IDENTITY.json`, `SOURCE-HASHES.json`, `SNAPSHOT-RECONCILED.json` and `FINAL-VERIFICATION.json` preserve provenance. Frozen input and original remain exact; candidate differs only in the three listed specs. Original fixtures and new first-failure logs remain intact in this packet; prior C8a/C11 classification evidence remains in the sibling `c11-second-classification` packet.

## Precise patch delta

1. `packages/kernel/src/lib/internals/intercept-leaf-signals.spec.ts`: adds `expectScalarMetadata`, replaces seven metadata equality assertions across the five failing tests, and corrects the misleading no-context test title. The helper requires a plain object; the exact own string-key set; exact value/enumerable/configurable/writable descriptors for every expected field; exactly one own symbol named `ScalarPublicationCoverage`; and its exact undefined/enumerable/configurable/writable descriptor. No symbols are removed from actual metadata, no subset matcher is used, and capture/count/path/owner/previous/next/intent assertions remain. An unexpected string key, hidden string property, additional symbol, covered recipient value, or changed descriptor fails. This pins current receipt shape, not inaccessible private symbol identity or positive coverage forwarding.
2. `packages/kernel/src/lib/internals/causal-runtime/heterogeneous-live-subject.spec.ts`: replaces only the private reentry error matcher `/stale/` with the actual earlier preparation refusal message, with a source-order comment. The throwing sentinel expectation, reached-injection assertion, no-partial-membership/field state, independent count write, retry, held identity and redo assertions remain unchanged. `toThrow(string)` is Vitest's message containment matcher, not an exception-identity assertion; no stronger claim is made.
3. `packages/kernel/src/lib/structural-admission-sequence.spec.ts`: adds a two-subject seeded removal-recipe map and attaches its original key/value to removal effects. Unknown fixture subjects throw rather than silently using another subject's value. Recorded `before` stays independent (including `obsolete-key`); no current physical read supplies ordinary history. All eight test bodies/assertions remain unchanged, including numeric versus string keys and ordinary omission. Runtime adapter531–542 requires this recipe; unchanged complete-recipe and incompleteness-refusal controls run alongside the patch.

`git apply --check` on the untouched original succeeds (command, raw log and exit recorded). The patch is intended for this exact C11, not an unspecified current root checkout.

## Occupancy left open

`occupancy-successor-realization.spec.ts` is byte-for-byte unchanged. Its desired result remains `['a','b','c']`, same held a/b, a7/b88, one add for a, zero removes, one complete snapshot and later adoption rollback to b8. It still fails at ordinary admission.

The setup seeds ordinary membership then changes only physical membership/address through inspection. Fabricated ordinary add effects therefore target two ordinarily present lifetimes. A replacement fixture must establish legitimate ordinary absence/admission for the intended authored restoration while retaining the physical sparse a / transferred b state, source-owned lifetime identities and original placement anchors. It must then demonstrate the same complete success/callback/adoption assertions through an existing supported realization route. A private physical bypass, unsupported selected structural operation, duplicate ordinary add permission, or a refusal-only rewrite would not establish that behavior. This patch introduces none. No valid equivalent setup was demonstrated in this bounded work; leave the case open for the restoration/provenance owner rather than inventing policy.

## Executed checks

Node24.15.0 and pinned pnpm10.17.0; Nx daemon/plugin isolation disabled, skip cache, one worker, separate scratch Nx data/cache. `run.py` records exact argv, cwd, PATH and relevant environment plus raw first.log and exit for every run.

Both selected invocations use:

```text
corepack pnpm nx test kernel intercept-leaf-signals.spec.ts heterogeneous-live-subject.spec.ts structural-admission-sequence.spec.ts occupancy-successor-realization.spec.ts complete-structural-sequence.spec.ts structural-completeness.spec.ts --skip-nx-cache --maxWorkers=1
```

- `runs/original-selected`: **30 passed /10 failed**, 40 cases, six files, exit1.
- `runs/updated-selected`: **39 passed /1 failed**, same 40 cases, six files, exit1. Only unchanged occupancy remains red. No skip/filter or removed assertion produces this delta.
- `runs/original-spec-ratchet` and `runs/updated-spec-ratchet`: `node tools/check-spec-types.mjs`, both exit0, identical output. Three inherited improvements reported; no ratchet update applied.
- `runs/patch-apply-check`: clean application check, exit0.

No broad runtime suite, build, release gate or mutation campaign. Existing archived-tsconfig resolution warnings in first Nx runs are preserved; all selected cases executed. No runtime evidence is inferred from an unexecuted check.

## Fresh author review and independent review status

Fresh author-side diff review rechecked complete own-key coverage, the no-context title, synchronous nested frames, marker-case separation, recipe subject/key/value provenance, unchanged meaningful post-refusal assertions, and occupancy exclusion. No blocker found in these three test edits under the bounded contract. This is NOT a second independent reviewer verdict.

An independent reviewer received no preferred conclusion in the saved `independent-review/PROMPT.txt`: originals, proposed patch, relevant runtime/contracts and raw prior exact-C11 failures. Invocations/results:

- Claude CLI (actual available executable, no model assumption, tools disabled): exited1, `Not logged in · Please run /login`, zero API usage. Raw command/stdout/stderr preserved.
- Codex CLI read-only review: exited1 before review because the sandbox prevented app-server/state initialization. Raw command/stdout/stderr preserved in `independent-review-codex/`.
- Escalated retry was denied before execution by automatic approval review. The rejection says the payload contains private repository source/tests/logs and the user authorized independent review but not exporting it to the external Codex destination. It explicitly prohibits bypassing through indirect execution. Exact reason is saved in `INDEPENDENT-REVIEW-BLOCK.txt`. No further submission attempted.

Consequently independent review is OPEN before Main composes this patch. Needed next step: destination-specific authorization to submit this exact evidence packet to the external Codex reviewer, or a separately authorized reviewer supplied by Main. A prepared prompt is available; do not treat transport failures as approval or a clean review.
