# Kernel ownership ledger — `KERNEL-OWNERSHIP-INVENTORY-0`

⚠️ **SUBJECTS GENERATED, DISPOSITIONS RULED.** Regenerate with
`node tools/gen-kernel-ownership-ledger.mjs`. The subject column comes from
`tools/kernel-ownership-census.mjs`, which reads the repository;
`tools/check-kernel-ownership.mjs` fails when a censused subject has no row
(MISSING), when a row outlives its subject (STALE), or when any row is
`UNKNOWN`. **Every `UNKNOWN` blocks the destructive incumbent strip (Phase 3E).**

This phase exists because a *conceptual* inventory is not a census. The notifier
split moved delivery out of bare with 55/55 gates green, and that same class had
also been carrying producer-owned `batchUpdates` configuration, silently
discarded whenever no consumer existed. No recollection produced that; probing
the ordering by hand did. **A list written from memory cannot report what its
author forgot to think about.**

⚠️ THE CENSUS CAUGHT ITS OWN PARSER ON THE FIRST RUN. The barrel is heavily
annotated, and comment prose inside `export { ... }` blocks was extracted as
export names — four fabricated subjects, while the real `asReadonly`,
`createAuditTracker` and `toWritableSignal` went missing. Three genuine public
exports that appeared on no conceptual list we had assembled.

## ⚠️ THE FIRST VERSION REPORTED "143 SUBJECTS, COMPLETE CENSUS". RETRACTED.

It was neither complete nor a census of what it claimed. Two defects, both of
which made the gate look far greener than the repository was:

**74 discovered subjects never reached the gate.** The checker rebuilt the
subject set from a parallel hand-written list and omitted `runtimeState` and
`pipelines` entirely, plus 43 public type exports and 6 marker
factories/registrations. The census found them and printed them; nothing gated
them.

```text
A CENSUS THAT DISCOVERS A SUBJECT BUT DOES NOT GATE IT HAS NOT CLOSED THAT
SUBJECT.
```

The subject set is now emitted BY the census, and a self-check fails if any
discovered category reaches neither the gate nor a declared, reasoned refusal.
A parallel list is a second source of truth, and the second one always rots.

**94 rows were assigned KERNEL by inference, not ruling.** The generator applied
"bare reachable -> KERNEL" and "the symbol name lacks Entity/Subject -> KERNEL".
Both are invalid, and the first is the exact error this whole phase exists to
find: PathNotifier was bare-reachable, and that reachability WAS the ownership
error, worth 1.42 KB.

```text
REACHABILITY IS EVIDENCE ABOUT COST, NOT EVIDENCE ABOUT OWNERSHIP.
A SYMBOL'S NAME DOES NOT CHOOSE ITS OWNER.
```

Only two mechanical classifications survive, because the evidence settles them:
`specs-only -> TEST-SEAM` and `doc-comment-only -> RETIRED`. Even
`same-file-only` proves ONLY that the export is unnecessary; it says nothing
about who owns the code.

Removing the inferences moved 199 subjects to `UNKNOWN`. That number is the
honest state of the ledger, not a regression.

## ⚠️ "29 MODULE-STATE SUBJECTS" WAS A REGEX-SHAPED SUBSET. NOW 110.

The module-state detector matched three initializer shapes — `= new X(...)`,
`= {...}`, and a bare `let x: T;` — so it could not see any of

```text
let enabled = true;        let revision = 0;        let current = null;
let runtime = factory();   let stack = [];          const cache = signal(0);
const registry = factory();                         const listeners = [];
```

all ordinary ways to hold module-level authority. Its positive controls proved
the three shapes it already knew about. Replaced with a TypeScript AST walk over
every top-level `let`/`var`/`const`: **29 -> 110 bindings, plus 16 declined.**
It had been seeing 29 of 126 — and it was about to be the evidence behind
"MODULE-STATE-OWNERSHIP-0: 29 subjects", the first hidden-authority audit.

```text
FOR HIDDEN AUTHORITY DISCOVERY, OVER-INCLUSION IS CHEAPER THAN SILENT EXCLUSION.
A MODULE BINDING MAY BE DECLINED AFTER DISCOVERY; IT MUST NOT DISAPPEAR BECAUSE
ITS INITIALIZER SHAPE WAS UNEXPECTED.
```

Discovery no longer inspects initializers at all.

### ⚠️ AND AUTO-DECLINING THE 16 CONSTANTS WAS ALSO WRONG

The first fix discovered all 126 bindings and then auto-declined the 16 `const`s
bound to literal primitives: immutable, therefore no changing authority,
therefore not a subject. The first two steps hold; the third does not.

```text
const DEFAULT_BATCHING = true;
const MAX_HISTORY = 50;
const FLUSH_DELAY_MS = 0;
```

None is mutable. Every one makes an architectural decision.

```text
IMMUTABILITY PROVES ABSENCE OF MUTABLE STATE; IT DOES NOT PROVE ABSENCE OF
SEMANTIC AUTHORITY.
```

That was the same move as "bare reachable therefore KERNEL" — letting syntax
rule a fact irrelevant. All 126 are retained and merely ANNOTATED
`mutableCandidate`. `MODULE-STATE-OWNERSHIP-0` may attack the 110 mutable
candidates first; the 16 constants still owe a disposition under
`MODULE-CONSTANT-POLICY-0`.

The denominator for TOP-LEVEL BINDINGS is 126. The denominator for the narrower
MUTABLE-AUTHORITY investigation is 110. Those are different numbers and the
ledger says so.

### ⚠️ `exportedPipelineCandidates`, NOT "21 pipelines"

The detector means "an exported function whose NAME contains a verb like
publish/commit/notify". That is a candidate finder, not a census of behavioural
pipelines — it cannot see `applyWrite`, `const flush = () => {}`, a class
method, or any non-exported convergence function. Renamed so today's `21` cannot
become tomorrow's `29`. `PIPELINE-OWNERSHIP-0` owes a real behavioural
denominator.

## ⚠️ OWNERSHIP AND CONVERGENCE ARE TWO AXES

```text
KNOWN OWNER DOES NOT MEAN CONVERGED IMPLEMENTATION.
```

`defineStore` is decisively `FRAMEWORK-ADAPTER` and is still sitting inside the
thing we intend to call a neutral kernel. Gating on `UNKNOWN` alone would have
authorised the strip with adapters living in the kernel. Phase 3E therefore
requires **UNKNOWN owners = 0 AND unresolved convergence actions = 0**.

Actions: `CONVERGED` · `MOVE` · `SPLIT` · `REIMPLEMENT` · `DELETE` · `REVIEW`

⚠️ AND "NOTHING IMPORTS IT" WAS THREE ANSWERS, NOT ONE. Forty-four internal
exports had no production consumer. Collapsing them would have proposed deleting
live code: 36 are reached only by specs (deliberate seams), 7 are called inside
their own file (the `export` is unnecessary, the code is not), and exactly ONE —
`isAnySignal` — is reachable only from a JSDoc `{@link}`. That is the single
genuinely dead export in the package.

Owners: `KERNEL` · `FRAMEWORK-ADAPTER` · `OPTIONAL-CAPABILITY` ·
`DOMAIN-SPECIALIZATION` · `CONSTRUCTION-ONLY` · `DIAGNOSTIC` · `TEST-SEAM` ·
`AUTHORING-HELPER` · `CONSEQUENCE` · `RETIRED` · `UNKNOWN`

| subject | category | semantic job | owner | action |
|---|---|---|---|---|
