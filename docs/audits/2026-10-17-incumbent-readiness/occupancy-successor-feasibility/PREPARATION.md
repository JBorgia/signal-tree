# Concrete occupancy preparation contract (proposed, not implemented)

Base: rejected 6bd4ee8a and its frozen runtime. Owner payload decision95dbf59a applies.
Scope is private preparation/admission/realization. No new authority, public API,
frontier policy, later slice, or production acceptance.

## Data and lookup

Maintain sparse occupancy exceptions in both directions. Each lookup has three
states: override present, override absent, no override. `no override` alone may
fall through to native occupancy. A `byKey` lookup must check a candidate native
lifetime's ordinary binding; it cannot return a physically present lifetime that
is ordinarily absent or bound elsewhere. A staged key deletion shadows base
lookup, including physical fallback. Key and lifetime maps update together.

Preparation uses a private overlay with touched-key and touched-lifetime sets.
Never mutate installed indexes while deriving facts or calling user code. Record
before-facts once per touched address and ordered edits once per authored step.
The step's identity is its operation ordinal, not only its subject: a map keyed
only by lifetime cannot represent repeated operations on that lifetime.

`bind(L,K)`:
1. Resolve staged ordinary source key S for L and destination occupant D for K.
2. Capture source and destination before-facts, values and required placement
   facts before changing the overlay. These are existing recovery obligations.
3. If D exists and D != L, emit ordinary removal(D,K), clear D and K in overlay.
4. If L is absent, emit ordinary addition(L,K) with explicit authored value and
   placement; otherwise if S != K emit ordinary rekey(L,S,K).
5. Clear S when different, set K->L and L->K. Both directions are staged.

`unbind(L)` resolves its staged ordinary key, emits removal only if present,
and clears both directions. It does not remove another ordinary lifetime merely
because that lifetime shares L's physical key. Broader APIs supply their actual
broader intents; removal does not infer them from display.

Field values and explicit order remain separate inputs. Necessary-existence
adoption can request bind, but ordinary-existing field edits do not author keys.
Inspection supplies physical changes and freezes pre-change ordinary facts;
it supplies no authored ordinary occupancy edits.

## Forward installation and fanout

Prepare original ordinary edit sequence, normalized incumbent capture inputs,
physical mutation frame, index overlay, and source revision together. Validate
normalization before declaring this account complete: canceled contributions
remain canceled under the incumbent, but displaced before-facts may not vanish.

The source revision covers physical writes and changes to ordinary evidence;
equal displayed values cannot validate a stale ordinary plan. Existing available
revision machinery must be audited before implementation; no new public token.
User getters/cloning/equality and reentry happen before the final revision check.
Installation pairs responsibility/index state with the physical frame before
callbacks. Notification consumers select the same prepared operation's ordinary
or physical facts. Do not overwrite earlier step facts in a subject-keyed map or
replay a whole operation's ordinary list for every physical notification.

## Rejection preparation

Incumbent authority remains the sole authority to admit rejection. Normalized
ordinary inverse facts are immutable inputs to a separate physical realization
compiler, not physically executable instructions by assumption.

1. Obtain the admitted ordinary inverse and explicit value/placement facts.
2. Resolve current physical identity for all affected lifetimes and keys.
3. Form final occupancy for the complete authorized unit. First account for all
   vacates, then fills. A key vacated by this unit is available; a surviving
   unrelated occupant invokes the unchanged atomic conflict/refusal rule.
4. For an inverse ordinary addition: inactive lifetime needs exact-lifetime
   revival; already-active lifetime needs transfer from its actual physical key.
   Do not rewrite the original ordinary addition to a rekey in retained evidence.
5. For active transfer, retain current inspected physical fields, applying only
   explicit field reversals. Independently restore ordinary fields. Inactive
   revival uses retained ordinary restoration values. Owner's99/7 case follows.
6. Resolve placement separately using approved lifetime-sensitive successor and
   predecessor rules against final topology, including same-unit removed anchors.
   Transfer is not permission to preserve current position unconditionally.
7. Validate physical instructions/target and revisions. Same-key full-target,
   adapter point and S5 routes must all consume this one preparation, not rerun
   translation after validation or derive ordinary facts from physical targets.
8. Preserve existing compensated-frontier and discard preparation; install, make
   projections coherent, and finish terminal/publication handling under existing
   error semantics. Failure retains usable authority; success remains terminal.

This requires a private prepared realization handoff before validateEffects and
before full-target construction. A closure cache keyed only by effects identity
is insufficient: reentry can change physical or ordinary source state. The
prepared object needs an explicit lifetime bounded to that settlement attempt.

## Retirement

Committed supersession changes current ordinary facts but cannot make retained
inverse snapshots current again. Failed settlement releases no necessary claim.
Confirmation releases only its transaction's recovery claim. Divergence records
normalize after the complete P/O installation, not while intermediate vacates
make keys temporarily agree. Both directions normalize together.

Ordinary-present/physical-absent and ordinary7/physical99 remain live divergence
obligations even without pending transactions. Ordinary-absent/physical-absent
needs no occupancy exception when no other obligation depends on it. Existing
history, recovery and subscriptions retain their own claims. Held reference
identity cannot retarget replacement lifetimes and does not itself justify
retaining an entire historical tree. No collectibility result is claimed.

## Required executable boundary, not a pass count

Use actual incumbent folding and actual physical preparation to discriminate:
- displaced ordinary destination for creation/adoption/rekey;
- absent-old revival versus active-old transfer, including owner99/7;
- repeated same-key operation and canceled fresh lifetime;
- inverse key cycles and a destination vacated by the same unit;
- retained explicit placement versus missing/replaced/removed anchors;
- refusal/retry, reentry revision invalidation, terminal cleanup.

The two preserved native failures must remain unchanged controls. A standalone
map producing desired keys cannot qualify native folding, placement, capture or
publication. Any failure of those shared representations is recorded before a
successor runtime is selected, not concealed with a writer-specific branch.

## Folding finding and alternative requiring review

The extracted incumbent normalizer has no remove→add case for one lifetime.
The proposed chronological compiler can emit that pair when a first bind
ordinarily displaces a lifetime that remains physically active, then a later
operation binds that same lifetime elsewhere. Current native APIs admit that
sequence. Feeding that chronology unchanged into today's fold loses its final
ordinary-present fact. An inverse-add can still be physically realizable by the
new join; exact inverse spelling alone does not establish failed rollback.

A concrete alternative is transaction-wide per-lifetime occupancy accumulation:
retain first ordinary presence/key and latest ordinary presence/key, plus the
existing separately authored field and placement facts. Emit at normalization:

| Initial | Final | Structural result |
| --- | --- | --- |
| absent | absent | none |
| absent | present K | add K |
| present S | absent | remove S |
| present S | present K, S!=K | rekey S→K |
| present K | present K | none |

Canceled structural result does not cancel separately authored fields, explicit
order, necessary recovery facts or responsibility observation. Retain ordered
steps for their existing observation/dependency purposes; do not convert net
endpoints into new order authorship. Use this table across the pending capture
lifetime, not independently per native frame: consecutive API calls may have
separate frames inside one transaction. Recomputing a whole prior journal on
every write is not acceptable. Updating a touched lifetime's endpoints is bounded;
existing dependency/supersession predicates still decide admission.

This replaces an incomplete composition table, not settlement ownership. It has
not been implemented or verified. Review must establish which existing consumers
need intermediate existence facts before choosing this representation. No claim
that endpoint equality alone proves those facts irrelevant is permitted.

Physical planning has a separate gap: an active transfer may need authorized
placement. Sparse rekey carries no placement; remove+restore changes lifecycle
callbacks; blanket full-target routing changes work. A successor therefore needs
a private prepared transfer-plus-placement instruction, or proof that each
required case already uses a legitimate complete-target route. This cannot be
hidden inside the generic bind operation or solved by relaxing add validation.

## Concrete implementation seams, still gated

| Shared concern | Existing entry/consumer | Required change, not a completed repair |
| --- | --- | --- |
| Staged O lookup | entity-signal.prepareOrdinaryTopology / EntityOrdinaryTopology | Bidirectional staged key/lifetime lookup with explicit absence; common Bind/Unbind; group by operation step, not last subject record |
| Capture interval | transactions.prepareEntityResponsibility scratch composition and rich enqueueEffect | One common occupancy composition rule used by both; stage only touched records and install atomically; no divergence between early responsibility and notification capture |
| Normalized authority | pending rollback and inspection chronology | Preserve final ordinary occupancy and separately authored values/order; do not reinterpret missing after-state as present merely because P contains the lifetime |
| Physical join | rollbackPendingTarget before derive target, and pending port before validateEffects | Immutable ordinary inverse plus separate P plan; same base revisions through validation/install |
| Sparse placement | prepared key transfer / heterogeneous S5 planner | Carry permitted placement without synthetic remove/add lifecycle; maintain current frontier policy |
| Split values | prepare-entity-target existenceSubjects cleanup | Prepared O structural/value disposition replaces unconditional clearing; retain O7/P99 when live |
| Publication | frame capture, queued metadata, ordinary projection | Select the same prepared facts once; explicit empty does not fall back to physical facts |
| Retirement | topology/value divergence plus current obligation checks | Normalize actual agreement after whole install; release only obligation-free records; held references cannot retarget |

This table changes the predecessor assumption that complete per-operation
occupancy facts could simply lower into the unchanged capture fold. It does not
by itself justify runtime changes at all listed seams. The sparse placement and
capture-interval consumers must pass reviewed feasibility before selecting a
successor; no individual writer receives a compensating exception.
