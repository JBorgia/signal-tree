# Incumbent-influence audit — 15.0

> ⚠️ **THIS IS AN INCUMBENT-INFLUENCE AUDIT, NOT A GREENFIELD OWNERSHIP
> DERIVATION.** It is seed evidence for `KERNEL-OWNERSHIP-INVENTORY-0`, not
> architectural authority. Its enumeration is of PUBLIC EXPORTS, which is
> narrower than the set of mechanisms that can distort the kernel — the
> accessor/store duality proves the point, being one of the largest suspected
> distortions while not being a public feature at all. Read the ruling block at
> the end before citing any conclusion here.

**Question.** Has the incumbent implementation negatively shaped SignalTree? Is
the kernel directing the implementation, or is the implementation still
directing the kernel? Would a greenfield derivation reach different answers?

**Answer.** Yes, in five identifiable places. One was found and repaired during
this session and was worth 1.42 KB — 13% of the bare bundle. Three remain. One
is a judgement call the evidence does not settle.

Everything under "measured" was produced by the canonical size pipeline
(esbuild bundle+minify, ESM, browser, treeShaking, `ngDevMode: false`, gzip
level 9) against a provenance-checked build. Everything under "assessment" is
judgement and is labelled as such.

## Measured cost of every public feature

Marginal gzip over a bare tree, each feature imported and exercised:

| feature | prod gzip | delta | source lines |
|---|---|---|---|
| bare kernel | 9.22 KB | — | ~6,000 |
| `derivedFrom` | 9.21 | **−0.01** | thin |
| `devTools` | 9.29 | +0.07 | 2,100 (dev-gated) |
| `defineStore` | 9.34 | +0.12 | thin |
| `external` | 9.51 | +0.29 | thin |
| `batching` | 10.04 | +0.82 | 441 |
| `link` | 13.32 | +4.10 | 635 |
| `persistence` | 15.72 | +6.50 | 1,467 |
| `entityMap` | 19.65 | +10.43 | 3,244 |
| `restoration` | 23.60 | +14.38 | 3,409 |
| `transactions` | 23.72 | +14.50 | 1,747 + causal-runtime |
| restoration + transactions | 30.26 | +21.04 | shares ~7.8 KB |
| entityMap + restoration | 33.57 | +24.35 | shares ~0.5 KB |
| **everything** | **46.79** | +37.57 | ~32,700 |

Three things this table says immediately:

- **The kernel is small and the mass is optional.** 9.22 KB of 46.79 KB. After
  the delivery split, a consumer pays almost exactly for what they use.
- **`derivedFrom`, `defineStore`, `external`, `devTools` are effectively free.**
  Under 0.3 KB each; `devTools` is `ngDevMode`-gated and vanishes in production.
  None of these needs justifying on cost.
- **`restoration` and `transactions` share ~7.8 KB** (the causal runtime) but
  `entityMap` and `restoration` share almost nothing (0.5 KB) despite both
  being about identity over time. That asymmetry is a finding in itself.

## Finding 1 — the delivery/producer bundle (REPAIRED, 1.42 KB)

`PathNotifier` was one class doing two unrelated jobs: the producer side the
kernel needs (`hasObservers`, `emitMutation`, `setBatchingEnabled`) and the
consumer side only optional features need (subscribe, intercept, pattern match,
batch, flush). Because they lived in one class, the bare kernel statically
linked all of it and executed none of it — `owned-mutation` had *already* been
guarding on `hasObservers()` for however long.

That is the purest possible example of the incumbent directing the kernel: no
derivation would ever conclude "the producer must own the delivery engine". It
was true only because the class existed first and everything reached for it.

Repaired this session (`PATH-NOTIFIER-DELIVERY-OWNERSHIP-0`): 10.65 → 9.22 KB,
both budgets green for the first time this release, and the entities bundle
dropped 1.42 KB as a side effect.

⚠️ AND IT COST A SECOND DEFECT ON THE WAY OUT. Splitting them revealed that the
class had also bundled *producer-owned configuration* with delivery, so
`batchUpdates: false` was silently dropped when no consumer existed. The
incumbent shape hid a real semantic conflation, not just bytes.

## Finding 2 — `subjectId` in the universal mutation envelope — OPEN

```ts
// mutation-types.ts — the KERNEL's universal envelope
export interface MutationEnvelope<T = unknown> {
  readonly positionId: PositionId;
  readonly subjectId?: number;   // populated only by entity-signal
  ...
}
```

Entity-originated subject identity crosses common causal and mutation
infrastructure: allocated by `entity-signal`, threaded through `path-notifier`,
`link`, `source-mutation` and a dedicated `subject-reclamation-sink`.

**The question is legitimate.** Is logical subject identity genuinely a generic
causal concept, or is entity-specific identity leaking into the kernel
representation?

### ⚠️ MY FIRST ANSWER TO IT WAS NOT ADMISSIBLE — RETRACTED

I wrote that greenfield would carry one identity, structural position, with
entity identity demoted to a projection. **That is not proven, and the reasoning
that produced it is the reasoning this repository has a rule against.**

```text
subjectId is created by entityMap
  + it appears in common infrastructure
  = greenfield should eliminate it in favour of PositionId
```

does not follow. And the evidence I leaned on —

```text
subjectId   651 references
PositionId  227 references
```

— says nothing about redundancy. Raw reference counts are not ownership.

```text
FIELD PRESENCE IS NOT SEMANTIC OWNERSHIP; TRACE THE CONSUMER
```

The two plausibly answer different questions, and can legitimately diverge:

```text
PositionId   structural/location identity — "where is this in the topology?"
subjectId    logical subject identity     — "which continuing subject is this?"
```

Rekey, remove-and-reactivate, historical restoration and subject lifetime are
exactly the operations under which those two must be allowed to disagree. A
kernel that collapsed them would have no way to say "same subject, new
position", which is what undo of a move IS.

**Disposition: `SUBJECT-IDENTITY-OWNERSHIP-0`, open.** Do not assume
`PositionId` can replace `subjectId`. Do not assume `subjectId` must remain in
the universal envelope. Trace the required consumers first — and note that if
the discriminator finds the concept genuinely belongs in the causal model, the
651 references are not debt, they are the implementation having earned its
place. That is the difference between legacy-LOOKING and legacy-OWNED.

## Finding 3 — accessor/store duality

One semantic branch is two physical objects. The stated reason is entirely
mechanical:

> Properties must be writable to allow `materializeMarkers()` to replace markers
> with their signal forms.

That is not a semantic requirement. It is a construction-order accident: markers
are materialized *after* the accessor is built, so the accessor needs writable
copies of the store's properties, so now there are two objects that must agree
about everything forever.

Measured cost, this session alone:

- first appearance had to define both — bug 1
- dynamic reacquisition had to activate both — bug 2
- **no deactivation path had ever touched the accessor at all** — bug 3, a live
  second-observable-state defect where `Object.keys($.user)` and `{...$.user}`
  reported a removed member the snapshot correctly omitted
- a convergence helper (`setMemberPresence`) now exists solely to make the
  duality safe, plus a reverse peer link

**Greenfield would not do this.** Materialize markers first, then build one
object. There is no contract requiring two.

**Assessment: the highest-value structural cleanup available**, and unlike
finding 2 it is bounded — the duality is internal, four transition sites, all
now funnelled through one owner. That funnel is what makes the eventual
unification tractable.

## Finding 4 — `entityMap`'s implementation predates the substrate it could use

`DYN-ENTITY-OWNERSHIP-0` ruled **H-B**: the entity *domain* is real and cannot
collapse into generic dynamic topology, because object property keys are always
strings and integer-like keys enumerate in ascending numeric order — so typed
numeric identity and insertion ordering are structurally impossible there.

That ruling protects the **semantics**. It does not protect the **3,244-line
implementation**, which was written before the dynamic substrate existed and
therefore carries its own identity acquisition, membership, lifecycle and
observation machinery. The measured near-zero sharing between `entityMap` and
`restoration` (0.5 KB of 24.35) is consistent with a subsystem that solved its
problems privately.

**Assessment: probably several KB of duplicate substrate**, but this is
inference from a sharing asymmetry, not a measurement of duplication. It needs
its own audit (`ENTITY-REPRESENTATION-OWNERSHIP-0`) before any number is
claimed. Note that it would return **zero** bytes to the bare budget —
`entityMap` contributes 0 B there, measured.

## Finding 5 — `link` at +4.10 KB

`link` is 635 source lines but costs 4.10 KB because it is the one non-enhancer
public API that subscribes, so it pulls the whole delivery engine with it. Post
split that is now *correct* — it pays for what it uses — but it means `link` is
the most expensive small feature in the library by a wide margin.

**Assessment: not a defect, but worth knowing.** If `link` is a headline
feature, 4.10 KB is the price of the notifier for anyone who uses it. If it is
niche, it is 4.10 KB sitting on the public barrel.

## Where the incumbent did NOT hurt

Being fair to the existing design, several things a greenfield derivation would
plausibly have gotten *worse*:

- **Enhancers as injected features.** The declarative `{ enhancers: [...] }`
  construction with `ngDevMode` gating gives `devTools` a 0.07 KB production
  cost. That is a good pattern, and it is the pattern the delivery split reused.
- **Markers as a registry.** `entityMap`, `form`, `stored`, `async`, `compared`
  all materialize through one processor registry with a symbol fast path. That
  is why `entityMap` could be priced, split and ruled on at all.
- **Capabilities.** `causal-runtime` and `position-topology` as opt-in
  capabilities kept 5,044 lines of causal runtime out of bare entirely —
  measured 50 B of `materialization-realization` and nothing else.
- **The budget gate.** It caught a real 1.42 KB ownership error that no test
  could see, and it correctly refused a stale artifact when I accused it of
  measuring one.

## What a greenfield kernel would look like

```text
ONE identity                    structural position; entity identity is a
                                projection correlated to it, not a peer field
                                in the universal envelope

ONE physical object per branch  markers materialized before the accessor is
                                built, so no accessor/store pair exists

PRODUCER PORTS ONLY             the kernel declares nullable ports; every
                                optional consumer installs its own authority
                                (this is now true for delivery — and only
                                delivery)

ENTITY AS A SPECIALIZATION      ordered typed-key collection semantics layered
                                on the generic dynamic substrate rather than
                                reimplementing it
```

Three of those four are incumbent-shaped today. One was fixed this session.

## Ruling — `INCUMBENT-INFLUENCE-AUDIT-0`

```text
Finding 1  delivery ownership       CONFIRMED / REPAIRED
Finding 3  accessor/store duality   CONFIRMED incumbent-shaped representation
                                    PRE-1.0 discriminator required
Finding 4  entityMap substrate      PLAUSIBLE / measurement required
                                    PRE-1.0 representation discriminator
Finding 5  link cost                MEASURED / not an architectural defect
Finding 2  subjectId                QUESTION VALID
                                    proposed "one identity" answer NOT ADMISSIBLE
                                    ownership discriminator required

"nothing here blocks 1.0"           REJECTED
"complete audit of everything"      NOT YET
```

### ⚠️ "NOTHING HERE BLOCKS 1.0" IS REJECTED

That conclusion was measured against the wrong completion criterion. It is true
of *ship a working v15*. It is false of the stated goal — **make the new kernel
authoritative and strip incumbent representation before 1.0**. Shipping findings
3 and 4 knowingly would mean the honest claim is not

> the incumbent has been stripped and the greenfield architecture directs the
> implementation

but

> the greenfield architecture directs much of it, with known incumbent
> structural representation intentionally retained.

Those are different releases.

```text
GREENFIELD COMPLETION REQUIRES EVERY SURVIVING INCUMBENT MECHANISM TO EARN ITS
OWNER, NOT MERELY PASS THE EXISTING GATES
```

### ⚠️ "EVERY PUBLIC FEATURE" IS NOT "EVERYTHING"

The cost table enumerates root value exports. Kernel correctness is distorted by
things that are not exports at all — `TreeConfig` fields, capabilities, marker
processors, mutation-envelope fields, module singletons, the position registry,
publication carriers, membership revisions, commit clocks, causal adapters,
memoisation machinery, Angular lifecycle imports, package subpaths, caches,
error routing, realization adapters, diagnostic hooks. The accessor/store
duality is itself the proof: not a public feature, and possibly the largest
remaining distortion.

This document is therefore a SEED for the exhaustive census, not the census.
That is `KERNEL-OWNERSHIP-INVENTORY-0`, which is mechanical, gated, and treats
`UNKNOWN` as a blocker.

## Sequence

```text
PN-A / CURRENT-SIZE-D              CLOSED
KERNEL-OWNERSHIP-INVENTORY-0       BUILT — 143 subjects, 7 UNKNOWN
resolve every UNKNOWN              NEXT
BATCHING-OWNERSHIP-0               already row 1 of the UNKNOWNs
ACCESSOR-STORE-UNIFICATION-0       pre-1.0
ENTITY-REPRESENTATION-OWNERSHIP-0  pre-1.0, keep H-B semantics
SUBJECT-IDENTITY-OWNERSHIP-0       pre-1.0 discriminator
C6 framework/kernel handoff
3E incumbent deletion
PUBLIC API FREEZE -> RC -> 1.0
```
