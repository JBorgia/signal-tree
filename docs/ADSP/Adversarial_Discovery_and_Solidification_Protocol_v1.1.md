# Adversarial Discovery & Solidification Protocol (ADSP)

## A reusable system for architecture discovery, falsification, proof, migration, consolidation, and release

**Version:** 1.1  
**Origin:** Codified from the SignalTree v15 engineering program  
**Purpose:** Preserve the methodology itself so it can be reused on future systems, libraries, products, migrations, and architectural rewrites.

### Version 1.1 additions

Version 1.1 incorporates lessons earned after the initial codification and addresses critique of the first release. The major additions are:

- a proportional-rigor model defining when full ADSP is warranted and when it is overkill;
- an explicit greenfield rule: **solidify, then reimplement from the solidified model**;
- successor testing for compound operations and explicit invariant carriers during retirement;
- `VACUOUS` versus `ORPHANED` scenario disposition;
- contract-before-defect discipline;
- temporal-absence controls for asynchronous claims;
- the evidence-integrity triad: **REACH, READ, DISCRIMINATE**;
- explicit separation between globally shared semantic rules and consumer-local state;
- adapter guidance: **unify semantics, not representation**;
- a value-neutral semantic-transition discriminator for cases where authority/lifecycle changes without a state delta;
- stronger examples for vector cost analysis and preregistered asymptotic criteria;
- a companion-document boundary to reduce duplication between protocol and case study;
- a documented evidence gap for contract-level freeze reopening; and
- guidance for operationalizing ADSP as an AI coding-agent Skill.

---

## Executive summary

The most valuable output of a difficult engineering program is not only the resulting architecture. It is the **method that made the architecture trustworthy**.

ADSP is a repeatable engineering system for taking an uncertain, legacy-heavy, performance-sensitive, or semantics-heavy codebase through a sequence of:

```text
DISCOVER -> CHARACTERIZE -> FALSIFY -> REPAIR -> PROVE -> FREEZE
         -> CONSOLIDATE -> MIGRATE -> CONSUMER-PROVE -> RELEASE

For a greenfield rewrite, the implementation phase is deliberately different:

SOLIDIFY -> EXTRACT CONTRACTS -> REIMPLEMENT FROM THE SOLIDIFIED MODEL
         -> CONSUMER-PROVE -> RELEASE
```

The protocol was developed under conditions where ordinary engineering instincts repeatedly produced plausible but wrong conclusions. A faster implementation turned out to have unacceptable retained-memory cost. A weak-reference optimization passed the normal suite and failed under forced GC. A supposed persistence debounce turned out not to be debouncing at all under a serial Link boundary. A primitive that looked like another RxJS wrapper actually contained a substantial cache and persistence subsystem. A replacement for a retired primitive reproduced the intended architecture but silently died after the first request error until a behavioral recovery test caught it.

The system therefore assumes that **plausibility is not enough**.

Its core operating principle is:

> **State the property before the implementation, define the falsifier before the fix, measure the falsifier directly, and freeze only what survives an adversarial attempt to disprove it.**

For greenfield work, ADSP adds a second operating principle:

> **The evidence, contracts, matrices, and conformance tests are preserved. The implementation is not.**

A historical source file may explain why a behavior was discovered, but it does not become design authority merely because it survived in the incumbent implementation.

The protocol has four major outputs:

1. **Architecture:** responsibilities are assigned to the smallest truthful owner.
2. **Evidence:** every durable claim is attached to a measurement, control, or falsifier.
3. **Decision record:** rejected alternatives, non-claims, and open cells remain visible.
4. **Release system:** permanent tests and gates protect semantics without preserving archaeological implementation detail.

This document provides the rules, matrices, experiment templates, closure rules, migration discipline, gate discipline, and machine-codifiable schemas needed to reproduce the process on other projects.

## Contents

1. What ADSP is solving
2. The governing laws
3. Evidence taxonomy
4. The ADSP lifecycle
5. Experiment naming and commit discipline
6. The experiment card
7. The matrix system
8. The falsification pattern library
9. Discovery questions that repeatedly paid off
10. Solidification: how a discovery becomes a durable rule
11. Migration and retirement protocol
12. Consolidation protocol
13. Performance and memory protocol
14. Release validation layers
15. Gate the gate implementation
16. Worked examples from the SignalTree program
17. Anti-pattern catalog
18. Decision record format
19. Machine-codifiable project state
20. Reusable experiment YAML template
21. Review protocol for an AI coding agent
22. Minimal project bootstrap
23. Closure checklist
24. Retirement checklist
25. Performance checkpoint checklist
26. Release checkpoint checklist
27. The deeper philosophy
28. Operationalizing ADSP as an AI coding-agent Skill

- Appendix A. Blank matrix templates
- Appendix B. Example decision flow
- Appendix C. Vocabulary
- Final principle

---

# 1. What ADSP is solving

Traditional refactoring often begins from implementation shape:

- this module is large;
- this API looks redundant;
- these two abstractions look similar;
- this benchmark got faster;
- this test suite is green;
- this helper appears unused;
- this feature seems like a convenience wrapper.

ADSP begins from **semantic ownership and falsifiable properties** instead.

The method is designed for projects where one or more of the following are true:

- public API semantics are subtle;
- state, identity, lifecycle, caching, persistence, or transactions interact;
- an existing architecture accumulated feature-specific machinery;
- performance claims are important but noisy;
- memory and garbage collection matter;
- a major version is allowed to remove legacy concepts;
- tests may validate implementation rather than user-observable behavior;
- documentation, examples, tools, and AI instructions can continue teaching deleted APIs;
- the codebase contains historical experiment harnesses whose original purpose may already be subsumed;
- a real production consumer must eventually prove the architecture.

ADSP is **not** a mandate to rewrite everything. It is a method for determining what deserves to survive.

## 1.1 Proportional rigor: when full ADSP is overkill

The protocol is intentionally rigorous, but rigor must be proportional to semantic risk. Applying every matrix, mutation gate, and preregistration field to a private helper with obvious behavior is waste, not discipline.

Use the smallest profile that can still falsify the meaningful failure modes:

| Profile                   | Use when                                                                                                                       | Minimum expected discipline                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **P0 - Routine**          | Internal-only change, no public semantics, no concurrency/lifecycle/persistence ambiguity                                      | Property statement, direct behavioral test, type/lint/build gates                                      |
| **P1 - Focused**          | One meaningful semantic risk, localized ownership, low migration blast radius                                                  | Falsifier, positive control, focused experiment card, permanent behavioral carrier                     |
| **P2 - Full ADSP**        | Public API, identity, persistence, transactions, async races, lifecycle, retirement, or nontrivial ownership                   | Full lifecycle, matrices as applicable, mutation/gate validation, freeze record                        |
| **P3 - Release-critical** | Major-version architecture, multiple interacting semantic domains, production-consumer migration, or performance/memory claims | P2 plus production-consumer proof, release claim matrix, robust performance gates, consolidation audit |

Escalate the profile when a falsifier reveals hidden capability or ambiguity. De-escalate only when the remaining question is demonstrably local.

A useful test is:

> **If this conclusion is wrong, can it alter a public contract, corrupt durable/external truth, break identity/lifecycle, invalidate a migration, or create a materially false performance claim?**

If the answer is no, full ADSP may be unnecessary.

## 1.2 Companion-artifact boundary

ADSP artifacts have different jobs:

- **Protocol:** normative rules, lifecycle, matrices, templates, and gate requirements.
- **Case study:** evidentiary receipts showing where specific rules earned their place, including corrections and rejected interpretations.
- **Rulebook / Skill:** machine-enforceable summaries of the normative protocol.

When protocol and case study are read together, the case study SHOULD cite rule IDs rather than re-derive the rule verbatim. Some duplication may be retained for standalone readability, but future revisions should prefer cross-reference over repetition.

This boundary also prevents a case-study anecdote from silently becoming a governing rule without explicit solidification.

---

# 2. The governing laws

The rules below are written as codifiable constraints. In automation, each can become a checklist item, review rule, experiment-field requirement, or release-gate assertion.

## R-01 — Property before mechanism

Every experiment starts by naming the semantic property under investigation before proposing an implementation.

Bad:

> Replace stored with Link.

Better:

> Determine whether committed state can be durably synchronized through the existing relationship boundary without speculative transaction values becoming durable.

The second framing permits Link to win, fail, or prove incomplete.

## R-02 — Falsifier before fix

Before production changes, define what observation would make the current hypothesis false.

A falsifier must be concrete enough to implement as a test, probe, measurement, mutation, or consumer scenario.

## R-03 — Direct property beats proxy absence

Never use “nothing failed” as the only proof of a property when the property can be asserted directly.

Examples:

- Do not infer “no speculative writes persisted” from “rollback test passed.” Inspect every durable value and prove none equals speculative state.
- Do not infer “coalesced” from “final value is C.” Count durable writes and record timing.
- Do not infer “publicly unreachable” from “not in root index.” Inspect the package exports map and supported secondary entrypoints.

## R-04 — Positive evidence is required for positive claims

Absence of evidence is not evidence of the desired behavior.

If the claim is “latest request wins,” create slow-A / fast-B and assert B remains authoritative after A resolves later.

If the claim is “memory growth is bounded,” measure the slope or asymptote, not merely a smaller absolute number.

## R-05 — Architectural ownership is behavioral

A feature belongs to an architectural layer only if that layer owns a semantic responsibility that cannot be assigned more truthfully elsewhere.

File location, historical API shape, code volume, and sophistication do not establish ownership.

## R-06 — Convenience is not architecture

A primitive does not earn core status merely because it packages several ordinary operations conveniently.

If a behavior decomposes naturally into platform/library features already owned elsewhere, the primitive may be useful without being architectural.

## R-07 — No causal authority does not mean no capability

The absence of transactions, ownership identity, commit semantics, or error attribution does **not** prove a subsystem is empty.

A loader may fail the causal-ownership test while still containing valuable SWR, scoped caching, tag invalidation, or persistence behavior.

## R-08 — Operational knowledge may survive abstraction deletion

A retired primitive may contain a correct guard or lifecycle rule worth preserving.

Delete the abstraction only after reading and testing its operational behavior.

The canonical example is an async pipeline whose architectural role was unnecessary but whose implementation correctly caught errors inside `switchMap`, preventing the outer stream from dying permanently.

## R-09 — If it never existed, would we invent it?

For every legacy primitive ask:

> If this API had never existed, and we were designing the current architecture from first principles, would we independently invent this concept?

This question is especially effective against compatibility-driven overdesign.

## R-10 — What becomes impossible if it is deleted?

The stronger retirement question is:

> What user-visible behavior becomes impossible if this API is deleted, assuming ordinary language/framework capabilities plus the legitimate final primitives?

Migration inconvenience is not an answer.

## R-11 — Sophistication is not ownership

A 700-line subsystem is not automatically more architecturally legitimate than a 20-line helper.

Complexity may be historical accumulation.

## R-12 — Public reachability is measured, not inferred

Before calling a change “breaking,” classify reachability:

- package root;
- supported secondary entrypoint;
- documented deep import;
- internal only;
- demo only;
- tools only;
- tests only;
- production consumer use.

“Exists in repository” and “published API” are different facts.

## R-13 — One experiment, one architectural question

Avoid combining unrelated changes into the same evidence boundary.

A commit should remain attributable to one decision whenever practical.

## R-14 — Stop when a falsifier fires

If a preregistered falsifier reveals an unmodeled capability, stop before deletion or redesign.

A stopped experiment is a success when it prevents a false conclusion.

## R-15 — Freeze only after closure

A contract becomes **FROZEN absent a new falsifier** only when:

- its observable behavior is characterized;
- its strongest plausible counterexample was tested;
- permanent conformance exists;
- open questions are separated from the closed contract.

## R-16 — Frozen means frozen

Do not redesign a frozen public contract because a later migration would be more convenient.

Only new falsifying evidence reopens it.

### Freeze-reopening record

When a new falsifier does reopen something frozen, record:

1. the exact frozen claim;
2. the new evidence unavailable at freeze time;
3. whether the **decision**, the **supporting evidence**, or both were invalidated;
4. the replacement contract/evidence;
5. which permanent conformance changed; and
6. the new freeze boundary.

**Evidence-coverage note (v1.1):** the SignalTree program has a clean example of reopening and replacing _supporting evidence_ while preserving the conclusion (the incorrectly characterized rekey probe was falsified by an operation-reached-mechanism control). It does **not yet** contain an equally clean example of a frozen public contract being reversed by later falsifying evidence. That remains an explicit case-study coverage gap rather than being filled with a manufactured example.

## R-17 — Non-claims are first-class engineering output

Every closure record should include what is **not** being claimed.

Examples:

- runtime-local identity is not persistent identity;
- full-state describes a synchronization boundary, not internal mutation granularity;
- a core mechanism relevant to a production consumer is not proof that the consumer is already fixed;
- a timing flake is not a correctness regression.

## R-18 — Historical truth is preserved

Do not rewrite old architecture records, RFCs, changelogs, or experiment reports to pretend deleted concepts never existed.

Update current guidance; preserve historical evidence.

## R-19 — Compiler-driven deletion where possible

When deleting types or marker-resolution machinery, let typecheck reveal the dependency surface.

Remove only the primitive-specific rows first. Repair generic invariants explicitly.

## R-20 — Dead generic machinery should die

If the only remaining reason for a generic conditional/helper is a deleted feature, measure reachability.

If no surviving real surface can exercise it, delete it rather than inventing synthetic tests to preserve abstraction inventory.

## R-21 — A test must test the claim

A rendered snippet containing the word `switchMap` is not behavioral proof of latest-wins.

`expect(true).toBe(true)` is not proof of disposal semantics.

Source-text assertions are acceptable only for properties runtime/type systems genuinely cannot observe.

## R-22 — Gate the gate

Every custom gate should have a self-test or mutation proving it can fail under a relevant defect.

A blind gate is not a gate.

## R-23 — Mutation evidence is valid only if the mutation crosses the checker

If a mutation never affects the code path a test observes, the test’s survival says nothing.

Use control mutations to prove the test is capable of detecting the intended class of failure.

## R-24 — Quarantine unexplained cells

Do not average away, hand-wave, or narratively “explain” benchmark cells that disagree with controls.

Mark them unresolved and exclude them from quotable claims until localized.

## R-25 — Measurement tools are systems under test

Scripts, greps, benchmark harnesses, memory collectors, and release gates can be wrong.

Test them with A/A runs, synthetic mutations, known fixtures, or alternate measurement methods.

## R-26 — Measure shapes, not just points

For performance and memory, scaling shape is often more architecturally meaningful than a single absolute number.

Examples:

- flat vs linear update cost;
- bounded vs unbounded retained memory;
- consumer fan-out scaling;
- history-window boundedness.

## R-27 — Economic dimensions are vectors, not one scalar

Do not claim that milliseconds “pay back” megabytes unless a product utility function says so.

Track separately:

```text
construction latency
steady-state CPU
operation latency
retained memory
peak/transient memory
developer coordination cost
```

## R-28 — Equivalent operations must be equivalent

Performance comparisons require an equivalent-operation matrix. Do not compare a richer semantic operation to a weaker competitor operation and call the result architectural proof.

## R-29 — Quiescence is part of memory semantics

Forced GC once is not enough when finalizers, event-loop turns, weak references, or teardown work remain pending.

Memory tests must define and use a quiescence protocol.

## R-30 — A/A spread defines the noise floor

A candidate performance delta smaller than harness spread is inconclusive, regardless of direction.

## R-31 — Preregister asymptotic criteria

If the goal is bounded retention, preregister “growth must stop” rather than “bytes must improve.”

This prevents partial improvements from being mislabeled as architectural completion.

## R-32 — Separate address, identity, ownership, and revision

Do not collapse:

- public address;
- subject lifetime identity;
- tree/owner identity;
- physical storage location;
- causal position;
- mutation revision.

Coincidence in one implementation is not semantic equivalence.

## R-33 — Separate physical truth, authorship, publication, and persistence

A rollback may restore physical truth without becoming a new user-authored mutation.

Persistence observes committed truth; it does not own mutation authority.

## R-34 — A lifecycle boundary must be explicit

If write-active structures remain retained until teardown, `destroy()`/`dispose()` is an ownership boundary, not optional hygiene.

## R-35 — Settlement has semantics

Do not use “settled,” “flushed,” “scheduled,” and “durable” interchangeably.

Measure what each means.

## R-36 — Explicit operations and automatic consequences may have different error channels

An explicitly awaited operation may reject to its caller while automatic background egress reports globally.

Do not force symmetry merely for aesthetic API consistency.

## R-37 — Migration preserves needs, not old nouns

A demo scenario such as “debounced search” should survive even if the primitive named `asyncQuery` does not.

Preserve the lesson; change the owner.

## R-38 — Production consumers outrank toy examples

A real application can falsify assumptions that unit tests and demos miss.

Use production consumers late in the process as architectural conformance, not early as an excuse to preserve legacy workarounds.

## R-39 — Consolidation must itself be evidence-driven

Historical harnesses and source-text sentinels may be deleted only after proving their falsifiers are subsumed by production-facing permanent tests.

## R-40 — Closed architecture and open implementation work can coexist

A concept can be architecturally settled while migration, ergonomics, documentation, or performance proof remains unfinished.

Do not reopen semantics to solve downstream cleanup inconvenience.

## R-41 — Solidify, then reimplement from the solidified model

For a greenfield rewrite, contracts and proofs are design authority; historical implementation is not.

The sequence is:

```text
DISCOVERY/FALSIFICATION
        -> SOLIDIFIED CONTRACTS
        -> MIGRATION/RETIREMENT DISPOSITION
        -> CONTRACT EXTRACTION
        -> GREENFIELD REIMPLEMENTATION
        -> CONFORMANCE / CONSUMER PROOF
```

A rewrite that copies incumbent structure because it is easier is a refactor, not a greenfield implementation.

## R-42 — Compound operations require a successor control

A compound operation is not characterized by its immediate final state alone. Test at least one valid operation that follows it.

Example: a persistence `clear()` may remove durable state **and keep the relationship alive**. A test that checks only “the key is gone” misses the lifecycle half; the successor write proves whether the relationship survived.

## R-43 — Every surviving invariant needs a carrier

Deleting an abstraction does not authorize deleting an invariant it happened to carry. Before retiring an archaeological test, classify the invariant it protects.

- **CARRIED:** another permanent test/gate now proves it.
- **VACUOUS:** the final architecture makes the scenario impossible.
- **ORPHANED:** the scenario remains possible but no surviving carrier proves it. This is a hard stop.

This rule prevents implementation archaeology from being mistaken for semantic redundancy.

## R-44 — Contract before defect

Before declaring behavior a defect, determine whether the operation, location, and semantics are actually supported.

A surprising result from an unsupported marker position, a payload field that merely resembles an identity key, or a synthetic operation that never reaches the named mechanism may be diagnostic evidence rather than a product defect.

Characterize the contract first; then classify the observation.

## R-45 — Temporal absence requires temporal authority

When claiming that an asynchronous consequence **did not happen**, observe beyond every scheduler, debounce, poll, retry, or queue window that could still produce it - or control the scheduler deterministically.

Absence before the earliest possible execution time is not evidence.

This is the **TEMPORAL-ABSENCE CONTROL**.

## R-46 — Reach, read, discriminate

A measurement supports a mechanism claim only when all three are true:

1. **REACH:** the operation demonstrably exercised the mechanism under study.
2. **READ:** the measured value was interpreted directly, not through a lossy rendering or misleading label.
3. **DISCRIMINATE:** a plausible implementation that omits/replaces the claimed mechanism fails the case.

These correspond to:

- **OPERATION-REACHED-MECHANISM CONTROL**;
- **READ THE OBSERVATION, NOT ITS RENDERING**; and
- **MECHANISM-DISCRIMINATING CASE**.

## R-47 — Shared semantic law does not require shared mutable state

A rule may be globally architectural while the state needed to enforce it remains consumer-local.

Share the law or algorithm when it is genuinely common; do not centralize mutable authority merely to avoid duplication.

This is especially important when different consumers have distinct baselines, lifecycles, external acknowledgements, or settlement semantics.

## R-48 — Unify semantics, not representation

When unlike source shapes participate in the same architectural law, prefer a common protocol or adapter over forcing them into a universal representation.

A scalar, branch, and entity collection may share authority/reconciliation semantics while retaining different native identity and projection structures.

Adapters translate source-native semantics; they do not erase them.

## R-49 — Semantic transitions may be value-neutral

Do not infer that “no observable value changed” means “no semantic transition occurred.”

Authority, ownership, lifecycle, acknowledgement, or baseline state may change even when applying the new value is a no-op. Permanent conformance should include at least one discriminator where the semantic transition matters but the observable value before/after is equal.

---

# 3. Evidence taxonomy

ADSP requires claims to carry a provenance category.

| Category                 | Meaning                                                                                                            | Allowed use                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Observed**             | Directly measured in code, runtime, production consumer, controlled test, benchmark, GC probe, or package artifact | May support a concrete claim                                    |
| **Strategic assumption** | Deliberately chosen workload/product envelope                                                                      | May guide optimization, must not be presented as observed usage |
| **Inference**            | Architectural explanation consistent with evidence                                                                 | May guide next experiment, not closure by itself                |
| **Advisory**             | External/local review or dirty-tree observation not reproduced on authoritative state                              | Hypothesis only                                                 |
| **Historical**           | True of an earlier version/commit/architecture                                                                     | Preserve in record, do not present as current behavior          |
| **Open**                 | Not established                                                                                                    | Must not be silently filled in                                  |
| **Quarantined**          | Measurement exists but controls disagree or harness is suspect                                                     | Excluded from quotable evidence                                 |
| **Non-claim**            | Explicitly outside the guarantee                                                                                   | Protects against later overstatement                            |

## Evidence priority

When evidence conflicts, prefer the source that most directly represents real product semantics:

1. real production application behavior and runtime traces;
2. controlled consumer/package integration tests;
3. direct behavioral falsifiers;
4. type-contract and public-surface tests;
5. source-level ownership/call-graph audits;
6. benchmark harnesses whose controls have passed;
7. competitor/reference implementations;
8. convenience arguments or code shape.

## 3.1 Evidence-integrity triad: REACH, READ, DISCRIMINATE

Before promoting a probe from “interesting output” to architectural evidence, ask three questions:

### REACH

Did the operation actually exercise the mechanism named in the claim?

A source file containing `kind: rekey` plus a payload mutation that looks like a rekey is not enough. Assert the mechanism's own observable effect - for example, the collection index actually moved.

### READ

Are we reasoning from the measured value or from a lossy rendering?

`JSON.stringify` omits properties whose value is `undefined`; a grep pipeline can hide exit status; a pretty-printer can reorder or omit fields. Assertions should target the value itself.

### DISCRIMINATE

Does this case require the mechanism we claim it proves?

A correct final value may be produced accidentally by a simpler wrong algorithm. Mutation or alternate implementation controls should show which case actually distinguishes the mechanism.

The triad is summarized as:

```text
REACH the mechanism.
READ the value.
DISCRIMINATE the mechanism.
```

---

# 4. The ADSP lifecycle

## Stage S-01 — Inventory

Before changing production code, build a factual inventory.

Typical questions:

- What symbols/files actually exist?
- Which are reachable from published surfaces?
- Which have real production consumers?
- Which are tests, docs, comments, demo, tools, or historical artifacts?
- What behaviors does the implementation actually contain?
- What adjacent systems might overlap?

Output: **Consumer & Reachability Matrix**.

## Stage S-02 — Frame the architectural question

Turn an implementation-shaped problem into an ownership/property question.

Example transformation:

```text
"Can loader be rewritten with Link?"
        ->
"Which loader behaviors require SignalTree ownership, which are cache policy,
which are persistence policy, and which are ordinary application async?"
```

## Stage S-03 — Preregister

Write the experiment before implementing the answer.

Minimum fields:

```text
experiment id
question
scope
null hypothesis
falsifier(s)
possible outcomes
prohibited changes
controls
success criterion
stop condition
```

## Stage S-04 — Characterize current behavior

Read implementation and write a behavior matrix before migration.

Do not infer from API names.

This is where hidden operational knowledge often appears.

## Stage S-05 — Build the load-bearing discriminator

Choose the smallest experiment where competing architectural explanations produce different observable results.

Examples:

- slow A / fast B for stale-result authority;
- rollback with durable egress for speculative-write leakage;
- forced GC with held stale handles for lifetime identity;
- catastrophic production mutation for harness usefulness;
- alias mutation for type-contract liveness.

## Stage S-06 — Validate the harness

Run controls that prove the discriminator itself is live.

Examples:

- A/A timing spread;
- mutation kill test;
- positive and negative fixture;
- known-bad implementation;
- whole-array or whole-file controls;
- alternate measurement method.

## Stage S-07 — Interpret, do not rationalize

If the falsifier fires, stop and update the model.

If the result is surprising, make the surprise explicit.

A correction recorded in place is stronger than a silent edit because it teaches future readers which reasoning pattern failed.

## Stage S-08 — Prototype the smallest truthful owner

When a responsibility has an apparent final owner, prototype it using existing frozen primitives before adding API.

The question is not “can we make the old API fit?” but “can the behavior be expressed truthfully without recreating the old abstraction?”

## Stage S-09 — Close or split

An experiment closes only when its preregistered rows are disposed.

If one surviving capability has an unresolved owner, create a narrower experiment named after the capability, not the legacy primitive.

Examples:

```text
ASYNC-STALE-AUTHORITY-0
PERSISTENCE-DECOMPOSE-0
LOADER-CACHE-DISPOSITION-0
ERROR-OWNER-IDENTITY-0
```

## Stage S-10 — Freeze and consolidate

Once closed:

- freeze the public/semantic contract;
- convert experimental proof into permanent conformance;
- archive or delete archaeological harnesses only after proving redundancy;
- preserve the decision record;
- proceed to migration without reopening architecture.

---

# 5. Experiment naming and commit discipline

ADSP uses named experiments because names create a durable semantic index.

## Naming format

```text
<CAPABILITY>-<QUESTION>-<N>
```

Examples:

```text
HIST-SCOPE
LINK-HANDLE-0
ERROR-SURFACE-2
COMPARISON-FULL-STATE-0
ASYNC-QUERY-DECIDE-0
PERSISTENCE-DECOMPOSE-0B
CONSOLIDATION-0
```

The name should identify the **question**, not the implementation patch.

## Commit rule

Whenever practical, land separately:

1. experiment / evidence;
2. production repair;
3. public exposure;
4. conformance;
5. consolidation;
6. migration.

This keeps regressions attributable and allows later archaeology to reconstruct why a decision was made.

## Closure states

Use explicit statuses:

```text
OPEN
STOPPED — FALSIFIER FIRED
OUTCOME A / B / C
CLOSED
FROZEN ABSENT NEW FALSIFIER
SUPERSEDED
RETIRED — HISTORICAL ONLY
QUARANTINED
```

---

# 6. The experiment card

Every substantive experiment should have a card like this.

```yaml
id: PERSISTENCE-DECOMPOSE-0
status: OPEN
question: >
  Can committed state persistence be expressed through the frozen relationship
  boundary plus an application-owned storage adapter, with no new core API?

null: >
  Existing Link semantics already own synchronization, commit-boundary behavior,
  failure recovery, and local settlement. Storage backend, codec, migration and
  scheduling are adapter/application policy.

falsifiers:
  - speculative transaction values become durable
  - local settled() resolves before durable completion
  - remove/clear semantics require SignalTree to invoke storage deletion
  - migration cannot be expressed outside Link without semantic loss

outcomes:
  A: existing primitives suffice
  B: internal capability required
  C: new experiment required for one unresolved owner

prohibited_changes:
  - no Link API expansion
  - no global flush replacement
  - no persistentLink convenience primitive

controls:
  - rollback and commit pair
  - failing write followed by successful write
  - explicit retrieve failure followed by recovery
  - timing instrumentation

success_criterion: >
  Every historical behavior is assigned to Link, adapter, application, loader
  cache policy, or DELETE; no open matrix cell remains.
```

---

# 7. The matrix system

The matrices are the main codification mechanism. They force the team to keep categories separate and make omissions visible.

---

## M-01 — Public Reachability & Consumer Inventory Matrix

### Purpose

Prevents repository presence from being confused with published or production-used API.

### Columns

| Symbol / file | Root export | Secondary export | Deep import | Prod code | Demo | Docs | Tools | Tests | Historical | Disposition |
| ------------- | ----------: | ---------------: | ----------: | --------: | ---: | ---: | ----: | ----: | ---------: | ----------- |

### Rules

- Count real code separately from comments.
- Inspect package exports, not only source barrels.
- Historical docs never block retirement by themselves.
- Demo/tool use is migration work, not architectural demand.

### Exit criterion

Every candidate symbol has both **reachability** and **consumer** classification.

### SignalTree example

The migration inventory corrected an earlier assumption that internal marker barrels made several retiring primitives public. Package reachability proved they were internal migration problems rather than new consumer-facing breaking changes.

---

## M-02 — Capability / Behavior Matrix

### Purpose

Defines what a primitive actually does before debating whether it should exist.

### Typical rows

```text
initial value
acquisition
refresh/retry
loading/error
cancellation
stale suppression
cache
persistence
serialization
migration
transactions
history
identity
lifecycle
settlement
error reporting
```

### Columns

| Behavior | Mechanism | Observable result | SignalTree-specific? | Independent consumer? | Preserve? | Final owner |
| -------- | --------- | ----------------- | -------------------: | --------------------: | --------: | ----------- |

### Rules

- Read code, not names.
- Every “owns X” statement must identify the mechanism.
- A field existing in a type does not prove the behavior is load-bearing.

---

## M-03 — Ownership Matrix

### Purpose

Assigns a surviving behavior to the smallest truthful owner.

### Owner vocabulary

```text
CORE STATE ENGINE
RELATIONSHIP / SYNCHRONIZATION
APPLICATION
FRAMEWORK / LANGUAGE
RXJS / QUERY LIBRARY
PERSISTENCE ADAPTER
REMOTE CACHE
TYPE SYSTEM
TOOLING
DELETE
```

### Decision questions

1. Who has the necessary information?
2. Who controls the relevant lifecycle?
3. Who can enforce the property without hidden coupling?
4. Would the owner exist if the legacy API never had?
5. Is the responsibility causal/semantic or convenience/policy?

### Important rule

A behavior may be valuable while its current owner is wrong.

Do not confuse a **reactive/runtime substrate dependency** with **framework-runtime integration** or **application policy**. A core engine may legitimately use a framework's reactive primitives as its substrate while DI, injection-context, component lifecycle, or destroy hooks belong in a framework adapter. Storage backend, codec, retry policy, and product-domain decisions remain application-owned unless evidence proves otherwise.

---

## M-04 — Falsifier Matrix

### Purpose

Ensures every hypothesis has a concrete disproof path.

| Hypothesis | Falsifier | Control | Expected if true | Expected if false | Result | Decision impact |
| ---------- | --------- | ------- | ---------------- | ----------------- | ------ | --------------- |

### Example

| Hypothesis                                                               | Falsifier                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Promise and Observable async acquisition have equivalent stale semantics | Slow A, fast B, A resolves last                                |
| Persistence rides committed truth                                        | Rollback after speculative A/B and inspect every durable write |
| Historical mode harness protects production                              | Catastrophic mutation in production Link                       |
| Weak interning preserves stale-handle correctness                        | Force GC while holding old facade                              |

---

## M-05 — Type Contract Matrix

### Purpose

Protects public consumer semantics during type cleanup.

### What to test

- exact return types;
- callable vs non-callable surfaces;
- writable vs readonly members;
- marker resolution;
- entity collection value types;
- negative controls (`Partial<T>` rejected, internal helpers unavailable);
- enhancer-added surface;
- branch vs leaf distinctions.

### Rule

Prefer exact type equality and negative tests over broad assignability.

### Liveness control

Mutate the alias/conditional deliberately and prove the type test fails before deleting the implementation.

---

## M-06 — Identity / Address / Ownership Matrix

### Purpose

Prevents several forms of identity from being collapsed.

| Concept     | Meaning                   |     Reusable? |  Persistent? | Scope               | Example            |
| ----------- | ------------------------- | ------------: | -----------: | ------------------- | ------------------ |
| Public path | User-facing coordinate    |           yes |        maybe | tree                | `orders.42.total`  |
| Subject ID  | Lifetime identity         |      no reuse |      runtime | subject             | entity lifetime    |
| Tree ID     | Owner correlation         | runtime-local |           no | process             | error attribution  |
| Position ID | causal/ownership position |    tree-local |           no | tree                | restoration target |
| Revision    | mutation/version sequence |     monotonic | not identity | storage/transaction | commit revision    |

### Rule

If two values are equal in one implementation, do not promote that coincidence into semantics without a falsifier.

---

## M-07 — Async / Race / Recovery Matrix

### Purpose

For every asynchronous primitive, distinguish mechanism-specific race behavior.

| Case              | Promise | Observable | Subscription | After failure | After dispose |
| ----------------- | ------- | ---------- | ------------ | ------------- | ------------- |
| overlapping A/B   | ?       | ?          | ?            | ?             | ?             |
| cancellation      | ?       | ?          | ?            | ?             | ?             |
| stale suppression | ?       | ?          | ?            | ?             | ?             |
| recovery          | ?       | ?          | ?            | ?             | ?             |

### Required discriminators

- slow A / fast B;
- failure then later success;
- teardown while in flight;
- repeated explicit retrieve;
- subscriber error vs inner error.

### Rule

Do not assume two asynchronous mechanisms have the same semantics merely because they share one API.

---

## M-08 — Persistence Decomposition Matrix

### Purpose

Separates synchronization, storage, codec, migration, scheduling, cache, and administration.

| Concept            | Historical primitive A | Historical primitive B | Final owner         | Preserve? | Notes             |
| ------------------ | ---------------------- | ---------------------- | ------------------- | --------: | ----------------- |
| state relationship | stored                 | loader.persist         | Link / loader cache |       yes | semantics differ  |
| backend            | Storage                | EntityStorageAdapter   | adapter             |       yes | low-level concept |
| codec              | custom                 | JSON                   | adapter             |       yes | Link transports T |
| migration          | version/migrate        | none                   | adapter/app         |  optional | not Link          |
| write scheduling   | debounce/maxWait       | immediate              | endpoint policy     |  optional | maxWait may die   |
| removal            | compound clear         | removeItem             | application/adapter |       yes | ordering matters  |
| scope GC           | n/a                    | maxScopes              | loader persistence  |     maybe | cache-specific    |

### Rule

Do not unify merely because both systems serialize bytes.

---

## M-09 — Migration / Retirement Matrix

### Purpose

Turns a deletion into a controlled migration instead of a grep-driven purge.

### Disposition vocabulary

```text
KEEP
DELETE
REPLACE WITH EXISTING PRIMITIVE
MIGRATE CALLER FIRST
APPLICATION OWNS
ADAPTER OWNS
NEEDS SEPARATE EXPERIMENT
HISTORICAL ONLY
```

### Columns

| Symbol | Reachability | Live consumers | Behavior provided | Final owner | Semantic or syntactic replacement? | Migration order | Demo impact | Tool/doc impact |
| ------ | ------------ | -------------: | ----------------- | ----------- | ---------------------------------- | --------------- | ----------- | --------------- |

### Rule

“Superseded” does not mean “delete immediately.” First disposition every behavior.

---

## M-10 — Demo Coverage Matrix

### Purpose

Makes the demo a public-API usability gate, not decoration.

| Public concept | Scenario | Automated proof | No internal API? | Ergonomic findings |
| -------------- | -------- | --------------- | ---------------: | ------------------ |

### Example rows

```text
scalar / branch state
entity collections
transactions
history/restoration
external ingress
Link scalar
Link branch
Link Row[] collection
retrieve / settled / dispose
full-value replacement
structural equality / echo suppression
onTreeError / TreeId / path
failed-send recovery
```

### Negative gate

```text
internal imports = 0
deleted APIs = 0
experimental modes = 0
patch/Partial Link semantics = 0
test helpers = 0
unjustified casts = investigate
```

---

## M-11 — Equivalent-Operation Performance Matrix

### Purpose

Prevents unfair comparisons and isolates semantic cost.

| Workload | Raw/base configuration | Featured configuration | Competitor equivalent | Semantics equal? | Scaling axis | Metric |
| -------- | ---------------------- | ---------------------- | --------------------- | ---------------: | ------------ | ------ |

### Required dimensions

- raw vs featured;
- construction;
- point update;
- collection-wide update;
- consumer fan-out;
- retained memory;
- peak memory;
- history window / retention;
- 1k / 10k / 100k or appropriate scaling range.

### Rule

Record shape:

```text
flat
sublinear
linear
superlinear
bounded asymptote
unbounded
```

Do not promote a single favorable timing into an architectural claim.

---

## M-12 — Release Gate / Mutation Coverage Matrix

### Purpose

Proves the release system can detect what it claims to protect.

| Gate | Claim protected | Relevant mutation | Mutation kills gate? | Blind? | Permanent? |
| ---- | --------------- | ----------------- | -------------------: | -----: | ---------: |

### Rule

Every custom gate needs a relevant mutation or known-bad fixture.

If mutation survives, either:

- the gate is blind;
- the mutation is not on its path;
- the claim is not actually protected.

All three require investigation.

---

## M-13 — Consolidation / Archaeology Matrix

### Purpose

Removes experiment residue without weakening protection.

| Historical harness | Original question | Winning result | Permanent surviving test | Catastrophic mutation caught by old harness? | Disposition |
| ------------------ | ----------------- | -------------- | ------------------------ | -------------------------------------------: | ----------- |

### Deletion authority

An archaeological harness may be retired when:

1. its winning semantic outcome is recorded;
2. production-facing tests assert that outcome;
3. a relevant production mutation fails the permanent tests;
4. the old harness adds no independent falsifier.

### Rule

Test count is not a quality metric. Redundant tests can reduce signal.

---

## M-14 — Release Claim Matrix

### Purpose

Prevents marketing/release prose from outrunning evidence.

| Claim | Evidence | Scope | Non-claim | Gate | Current status |
| ----- | -------- | ----- | --------- | ---- | -------------- |

### Example

```text
Claim: point updates do not inherently scale with unrelated collection width
Scope: tested operations and sizes in matrix
Non-claim: SignalTree wins every microbenchmark
Gate: update-matrix checkpoint
```

---

# 8. The falsification pattern library

These patterns are reusable across projects.

## P-01 — Slow A / Fast B

Use for:

- fetch authority;
- stale response suppression;
- sequence guards;
- cancellation;
- subscription vs Promise differences.

Protocol:

```text
A starts first, resolves last
B starts second, resolves first
assert final authority
```

## P-02 — Fail then recover

Use for:

- async pipelines;
- persistence writes;
- explicit retrieve;
- subscription errors;
- queue survival.

A subsystem that works until first failure is not live.

## P-03 — Rollback leakage probe

Use for consequences that must see committed truth:

```text
transaction
  write speculative A
  write speculative B
rollback
inspect every external consequence
```

The load-bearing assertion is **no speculative value escaped**, not necessarily “zero external work occurred.” Reconciliation of post-rollback truth may be legitimate.

## P-04 — Catastrophic production mutation

Use to test whether an experimental or release harness actually protects production.

Examples:

- prevent outbound sends from ever arming;
- make equality reference-only;
- bypass an ownership lookup;
- remove a type branch;
- disable a reclamation step.

The mutation should be severe enough that a meaningful conformance suite must fail.

## P-05 — Bypass probe

Temporarily make the candidate primitive inert while preserving enough construction for unrelated code to run.

Classify failures:

```text
own unit tests
marker/type-resolution tests
real independent consumer invariants
demo-only assumptions
source-text inventories
```

This separates “the abstraction tests itself” from “other behavior requires it.”

## P-06 — Forced GC / held handle

Use for lifetime and weak-reference correctness.

Hold a public handle to an old subject, retire/rekey/replace the subject, force quiescent GC, then determine whether the handle:

- remains bound to old lifetime;
- silently follows a new occupant;
- throws;
- becomes stale safely.

## P-07 — A/A harness control

Run identical implementation against itself using the same benchmark sequencing.

Use spread to define the noise floor.

## P-08 — Compiler mutation

For type semantics:

- mutate an alias;
- remove a conditional branch;
- widen a type;
- allow a previously forbidden call.

The characterization matrix must fail.

## P-09 — Reachability / exports probe

Build/package the actual artifact and inspect exports or install it into a consumer.

Source barrels are insufficient.

## P-10 — Call-graph unreachability proof

When a behavior is claimed impossible under a configuration, source-level structural proof can be stronger than a runtime sample.

Example:

```text
GC function has one call site
call site is inside persist-only branch
persist disabled -> branch unreachable
```

Be explicit that call-graph proof does not establish runtime ordering details it did not measure.

---

# 9. Discovery questions that repeatedly paid off

Use these as a standing review checklist.

## Architectural ownership

- If this feature never existed, would we invent it now?
- What behavior becomes impossible if it disappears?
- Who already owns the underlying semantics?
- Does the core engine have unique information needed to implement it?
- Is this causal correctness or product/application policy?
- Is this synchronization or merely acquisition?
- Is this identity, address, ownership, or revision?

## API

- Is this actually published?
- Is it root-reachable, secondary-entrypoint reachable, or only internal?
- Does the public contract expose machinery or only the necessary relationship?
- Would adding a method duplicate application-owned lifecycle?
- Is a proposed status field actually a semantic state or convenience UI state?

## Tests

- What mutation would make this test fail?
- Does this assertion prove behavior or spelling?
- Is the test protecting production or a local experimental implementation?
- Is a generic invariant being accidentally deleted with a primitive?
- Is generic machinery still reachable by any real surface?

## Performance

- What is the equivalent operation?
- What is the scaling dimension?
- What is the A/A spread?
- Was everything rebuilt?
- Are arms interleaved?
- Did we measure quiescent memory?
- Is the claim about absolute value or scaling shape?

## Migration

- Are we preserving a user need or merely an old noun?
- Which caller must migrate first?
- Are docs/tools/AI instructions still teaching the deleted API?
- Does a historical reference need to remain historical?
- Does the replacement preserve operational guards?

---

# 10. Solidification: how a discovery becomes a durable rule

Discovery is not complete when an experiment passes. It is complete when the result is transformed into a durable contract.

## Step 1 — Write the decision in one sentence

A good solidified rule is concise enough to survive implementation changes.

Examples:

> External synchronization exchanges complete values at the Link boundary.

> Persistence observes committed truth and is not mutation authority.

> Subject lifetime identity is distinct from reusable address/key identity.

> A zero-owner retired subject may be forgotten completely when no restoration owner can legally resurrect it.

## Step 2 — Record the falsifier that earned it

Future maintainers need to know why the rule is believed.

## Step 3 — Record the rejected alternatives

A rejected design without its falsifier will be rediscovered later.

## Step 4 — Create permanent conformance

Promote the winning semantic behavior into production-facing tests.

## Step 5 — Add non-claims

Prevent a narrow result from being generalized later.

## Step 6 — Freeze

Use explicit language:

```text
FROZEN ABSENT NEW FALSIFIER
```

## Step 7 — Consolidate archaeology

Remove temporary harnesses only after proving their falsifiers are subsumed.

## Step 8 — Reimplement from the solidified model when greenfield is the goal

A greenfield implementation begins from:

- frozen public contracts;
- permanent conformance tests;
- ownership matrices;
- non-claims;
- identity/lifecycle/error semantics; and
- preregistered performance constraints.

It does **not** begin from copying the incumbent module graph.

Discovery tests that exist only to explain how a decision was earned remain archaeology. Permanent conformance is the executable specification.

If understanding the new implementation requires historical knowledge of a retired feature, the design has not yet been extracted cleanly enough.

---

# 11. Migration and retirement protocol

Architecture closure and migration are intentionally separate.

## Phase A — Inventory

Count and classify every live reference.

## Phase B — Behavior disposition

For each behavior choose:

```text
FINAL ARCH PROVIDES
APPLICATION OWNS
ADAPTER OWNS
KEEP INTERNAL
DELETE
DEFECT — REPAIR FIRST
NEEDS SEPARATE EXPERIMENT
```

For every primitive-specific test or scenario, also classify its final carrier status:

- **CARRIED** - a surviving permanent test/gate proves the invariant;
- **VACUOUS** - the final architecture makes the scenario impossible, so no carrier is required;
- **ORPHANED** - the scenario remains possible but the retirement would remove its only proof. Stop retirement until a carrier exists.

A green suite after deleting an orphaned test is not evidence of safety; it may simply mean the invariant is no longer exercised.

## Phase C — Minimal truthful caller migration

Do not redesign every demo/docs scenario yet. Make live callers compile and teach the correct owner.

## Phase D — Delete primitive-specific implementation

Use compiler-driven removal.

## Phase E — Repair generic invariants

Three outcomes:

1. generic invariant has surviving real carrier -> migrate test;
2. generic machinery is reachable but untested -> add real test;
3. generic machinery is unreachable -> delete machinery.

Never invent a fake marker solely to keep a generic abstraction alive.

## Phase F — Tools, AI, docs

Update current guidance in the same retirement phase.

Particularly inspect:

- codegen scorers;
- prompts;
- benchmark fixtures;
- symbol inventories;
- route smoke tests;
- README examples;
- comparison docs.

A deleted API that remains rewarded by tooling is not fully retired.

## Phase G — Zero-reference gate

Report by category, not one grep count.

```text
production code
tests
demo live code
current docs
current tools / AI
historical records
```

Historical references are allowed.

## Phase H — Closure commit

State:

- what was deleted;
- what semantic lesson survived;
- what generic coverage moved;
- what behavior intentionally changed;
- public API delta;
- test/build/gate results.

---

# 12. Consolidation protocol

Long discovery programs accumulate tests that once answered legitimate questions but later become harmful:

- they pin temporary implementation shape;
- they carry local copies of the system under test;
- they duplicate permanent conformance;
- they make source-text assertions that type/runtime tests now supersede;
- they inflate test count while lowering confidence.

## Consolidation procedure

1. Inventory historical harnesses.
2. Write each harness’s original question and winning outcome.
3. Identify the permanent production-facing test that now asserts the outcome.
4. Apply a catastrophic production mutation.
5. Confirm permanent tests fail.
6. Check whether the historical harness adds any independent failure.
7. Archive reasoning.
8. Delete redundant harness.
9. Require zero production/public API diff in the consolidation commit.

This produces a smaller permanent suite with higher semantic density.

---

# 13. Performance and memory protocol

Performance is where evidence discipline most often fails.

## 13.1 Rebuild and interleave

Never compare stale build A to freshly built B sequentially.

Preferred sequence:

```text
A1 B1 B2 A2
or another interleaved order
```

## 13.2 Warmup, repetition, robust statistic

Avoid single wall-clock thresholds for release claims.

Use:

- warmup;
- repeated samples;
- median or another robust statistic;
- fixed environment where feasible.

## 13.3 A/A controls

Before trusting A/B, run A/A to quantify harness spread.

If candidate improvement is inside spread, call it inconclusive.

## 13.4 Equivalent-operation matrix

A competitor operation must perform equivalent semantics.

If your operation includes identity, history, transactions, or full-value materialization and the comparator does not, state the difference.

## 13.5 Scaling shape

Measure across meaningful sizes.

An optimization that changes:

```text
O(N) -> O(1)
```

may be architecturally more important than a 30% constant-factor win at one size.

## 13.6 Consumer fan-out

Test not only data size but number of dependents/subscribers.

## 13.7 Retained memory vs peak memory

Measure separately.

A fast materialized projection that permanently retains large snapshots may be a bad trade even if operation latency improves.

## 13.8 Quiescence

Memory measurement protocol should include repeated GC/event-loop turns until the chosen stability criterion is met.

## 13.9 Slope / asymptote gates

For reclamation, preregister the asymptotic requirement.

Example:

```text
Not enough: 249 B/entity -> 117 B/entity
Required: growth stops when no legal owner remains
```

## 13.10 Quarantine

If one benchmark cell consumes radically more memory than standalone reproduction and the cause is unknown, quarantine it.

Do not let it drive architecture until localized.

## 13.11 Worked vector/asymptotic example: consumer-local entity authority

A useful performance contract is not “the new design is faster.” It is a vector of allowed costs and forbidden growth modes.

For a consumer-local entity authority projection, a preregistration might state:

| Dimension                                 | Allowed / expected shape                                                     | Forbidden interpretation                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Retained projection state                 | `O(current subjects)` per participating consumer                             | Growth proportional to historical inspection operations                                             |
| Ordinary single-row update bookkeeping    | Target `O(1)`                                                                | Re-materializing the entire collection on every mutation                                            |
| Exceptional topology placement            | Up to `O(n)` worst case when traversing current non-authoritative neighbours | Treating an occasional linear traversal as proof of unbounded history                               |
| Complete outbound `Row[]` materialization | `O(n)` by contract                                                           | Claiming this inherent complete-value cost is a regression without an equivalent-operation baseline |
| Consumer fan-out                          | Explicitly measured across 1, N consumers                                    | Hiding duplicated consumer-local state inside one latency number                                    |
| Historical retention                      | `O(0)` beyond current topology                                               | A journal whose memory grows with number of past inspections                                        |

This illustrates **R-27**: cost is a vector, not one scalar.

It also illustrates **R-31**: the asymptotic success criterion is registered before optimization. A future benchmark may change constants, but it does not get to redefine “bounded” after seeing the result.

Until measured, these are **criteria**, not performance claims.

---

# 14. Release validation layers

ADSP recommends three distinct proof layers.

## Layer 1 — Core invariant suite

Answers:

> Is the engine semantically correct?

Protects:

- identity;
- transactions;
- history;
- link behavior;
- error attribution;
- collection semantics;
- reclamation.

## Layer 2 — Demo / public usability suite

Answers:

> Can a developer use the final public architecture correctly without internals or rescue casts?

The demo is a release gate, not decoration.

## Layer 3 — Production consumer audit

Answers:

> Does a real application survive migration without architectural workarounds?

A real consumer catches lifecycle, package, persistence, and ergonomics issues that toy examples miss.

## Release sequencing rule

Do not run the full release gate too early when known migration/demo/perf noise remains. Otherwise unrelated red cells blur architecture diagnosis.

---

# 15. “Gate the gate” implementation

A release system without liveness tests becomes ceremonial.

For each custom gate define:

```yaml
gate: history-retention-slope
claim: retained memory becomes bounded once no restoration owner remains
mutation: disable subject-forgetting step
expected: gate fails
```

Track:

```text
PROVEN
BLIND
ERRORED
NOT APPLICABLE
```

A gate suite can itself have a release criterion such as:

```text
self-tests proven = all
blind = 0
errored = 0
```

---

# 16. Worked examples from the SignalTree program

These examples are included because the methodology is easiest to remember through cases where intuition failed.

## 16.1 asyncQuery — deletion earned

Initial suspicion: the primitive might own async query semantics.

Measured implementation:

```text
debounce            debounceTime
dedup               distinctUntilChanged
stale suppression   switchMap
cancellation        switchMap
```

No unique causal integration existed. A plain RxJS discriminator reproduced slow-A / fast-B semantics without SignalTree. A bypass probe broke only the primitive’s own behavior specs and marker typing.

Decision:

> The primitive did not own asynchronous query semantics; it packaged an RxJS composition inside a state marker.

But deletion later revealed an operational lesson: a replacement that handled errors at the outer subscriber silently died after the first failure. A recovery test forced the correct `catchError` placement inside the per-query `switchMap`.

**Method lesson:** architectural deletion does not authorize discarding implementation knowledge.

## 16.2 loader — the deletion template was falsified

The next primitive looked superficially similar. Applying the asyncQuery template would have been wrong.

Inventory revealed:

```text
staleTime
SWR
tags
persistence
scoped storage GC
parameter equality
lazy loading
```

No unique causal authority existed, but meaningful caching capability did.

The experiment stopped before deletion.

**Method lesson:** no causal authority != no capability. Never reuse a retirement template by analogy without inventory.

## 16.3 persistence — frozen Link, decomposed policy

Question: did replacing stored require new core persistence API?

Strong falsifiers:

- rollback must not persist speculative values;
- local settlement must be a real durability boundary;
- codec/migration must remain outside Link;
- storage deletion must not require Link to gain `remove()`.

Results:

- rollback produced only post-rollback committed truth, never speculative values;
- endpoint `set()` promises made `Link.settled()` a local durability boundary;
- codec and migration lived entirely in endpoint `get`/`set`;
- automatic set failure reached `onTreeError`, explicit retrieve failure rejected to caller;
- remove/clear required explicit lifecycle ordering rather than new Link API.

A first claim that endpoint debounce coalesced A/B/C was withdrawn after instrumentation showed A and C both became durable and B never reached the endpoint. The coalescing belonged to Link’s serial reconciliation loop.

**Method lesson:** final-value assertions are insufficient for scheduling claims; instrument count and timing.

## 16.4 identity and reclamation

A weak interning design passed the ordinary suite and reduced memory. Forced GC with stale handles exposed incorrect lifetime behavior.

Later, a retirement tombstone ledger looked necessary until a falsifier proved stale-handle safety survived complete zero-owner forgetting.

**Method lesson:** ordinary correctness tests may not exercise lifetime transitions; GC is part of semantics when weak ownership exists.

## 16.5 type cleanup

A public type alias looked textually redundant. Instead of deleting it by inspection, the project built an exact type characterization and deliberately mutated the alias. The gate failed, proving liveness. Only then was the alias removed.

**Method lesson:** characterize -> falsify -> delete.

## 16.6 evidence consolidation

Several historical Link mode harnesses carried their own local Link implementations. A catastrophic mutation that disabled production outbound sends killed nine production-facing spec files and none of the local harnesses.

The historical harnesses were archived and deleted while their winning invariants remained in production conformance.

**Method lesson:** a test can be elaborate and still be irrelevant to production correctness.

---

# 17. Anti-pattern catalog

## A-01 — “The suite is green, therefore the architecture is correct”

Normal tests may miss GC, package exports, race ordering, timing, or consumer integration.

## A-02 — “This file is large, therefore it is architectural”

Complexity is not ownership.

## A-03 — “This primitive has no causal hooks, therefore it is empty”

It may still own cache/policy capability.

## A-04 — “Final value is correct, therefore coalescing is correct”

Count events and measure timing.

## A-05 — “Not root-exported, therefore unsupported”

Check exports map and supported secondary/deep imports.

## A-06 — “The replacement is simpler, therefore it preserved behavior”

Run failure, recovery, cancellation, disposal, and stale-result controls.

## A-07 — “Historical docs must be cleaned to zero”

Current guidance should be clean; historical evidence should remain historical.

## A-08 — “More tests means safer”

Archaeological tests can preserve obsolete implementation and hide which tests actually protect production.

## A-09 — “Benchmark improvement pays for memory”

Different dimensions require product budgets, not invented exchange rates.

## A-10 — “One GC is enough”

Not when weak refs, finalizers, or teardown work exist.

## A-11 — “We can widen the public API to simplify migration”

Frozen contracts are not migration helpers.

## A-12 — “A local review found it, so it is release truth”

Dirty-tree or stale-snapshot reviews are advisory until reproduced on authoritative clean HEAD.

## A-13 — “It did not happen yet, therefore it is excluded”

If the scheduler, poller, debounce, or retry has not had a chance to run, temporal absence proves nothing.

## A-14 — “The printed probe omitted it, therefore it is absent”

Renderers and serializers are lossy. Assert the measured value, not the pretty-printed representation.

## A-15 — “The test passes, therefore it proves this mechanism”

A case may prove an output while failing to distinguish the mechanism believed to produce it. Kill or replace the mechanism and verify which case fails.

## A-16 — “Shared rule means shared representation/state”

A common semantic law may be enforced through adapters while each source keeps its native representation and each consumer keeps its own authority state.

---

# 18. Decision record format

Every closed experiment should add a durable record with these headings.

```markdown
# <EXPERIMENT-ID> — <decision>

## Question

## Preregistered outcomes

## Strongest falsifier

## Controls

### Reach / Read / Discriminate status

- REACH:
- READ:
- DISCRIMINATE:

## Measurements

## Surprising/corrected assumptions

## Decision

## Ownership assignment

## Permanent conformance

## Non-claims

## Migration implications

## Invariant carrier disposition

- CARRIED / VACUOUS / ORPHANED:
- Carrier or reason:

## Open follow-ups

## Commit / artifact references
```

Corrections should be explicit:

```text
CORRECTION 1 — previous claim was too broad
CORRECTION 2 — first assertion tested the wrong property
```

This is not embarrassment. It is institutional memory.

---

# 19. Machine-codifiable project state

A future project using ADSP should maintain a structured registry of experiments and rules.

Recommended files:

```text
architecture/
  adsp-rules.yaml
  experiments/
    EXPERIMENT-ID.yaml
  matrices/
    reachability.csv
    ownership.csv
    release-claims.csv
  decisions/
    EXPERIMENT-ID.md
  gates/
    gate-self-tests.yaml
```

A companion YAML schema is provided with this document.

---

# 20. Reusable experiment YAML template

```yaml
version: 1
project: example
experiment:
  id: CAPABILITY-QUESTION-0
  status: OPEN
  question: ''
  scope:
    include: []
    exclude: []

  hypothesis:
    null: ''
    alternatives:
      A: ''
      B: ''
      C: ''

  falsifiers:
    - id: F1
      property: ''
      probe: ''
      expected_if_null: ''
      expected_if_false: ''

  prohibited_changes: []

  inventory:
    symbols: []
    consumers: []

  matrices:
    - name: capability
      path: matrices/capability.csv

  controls:
    positive: []
    negative: []
    mutations: []
    aa: []

  measurements: []

  corrections: []

  decision:
    outcome: null
    rationale: ''
    ownership: []
    frozen: false

  claims: []
  non_claims: []
  open_items: []

  migration:
    disposition: null
    callers: []
    demo: []
    docs_tools: []

  validation:
    tests: null
    typecheck: null
    lint: null
    build: null
    gates: []

  commit: null
```

---

# 21. Review protocol for an AI coding agent

ADSP works well with a coding agent when the agent is treated as an experiment executor, not an architectural authority.

## The human/architect supplies

- the question;
- preregistered outcomes;
- falsifier;
- prohibited changes;
- closure rule.

## The local agent supplies

- source inventory;
- exact code paths;
- executable probes;
- measured results;
- unexpected findings;
- compiler-driven migration;
- verification outputs.

## The reviewer supplies

- challenge to overclaims;
- missing controls;
- category corrections;
- whether closure criteria are actually met;
- authorization for the next phase.

This three-part loop is powerful because no single participant is rewarded for making the original hypothesis come true.

---

# 22. Minimal project bootstrap

To adopt ADSP on a new project:

1. Create `architecture/adsp-rules.yaml`.
2. Create an experiment registry.
3. Define evidence categories.
4. Inventory public surface and production consumers.
5. Identify one high-risk architectural question.
6. Write a preregistered experiment card.
7. Build a direct falsifier and harness control.
8. Run it before changing production code.
9. Record corrections explicitly.
10. Convert the winning result into permanent conformance.
11. Freeze the decision.
12. Only then migrate/remove implementation.

---

# 23. Closure checklist

An experiment is not closed until every applicable item is true.

```text
[ ] question is stated as a property/ownership question
[ ] null and alternatives were preregistered
[ ] direct falsifier exists
[ ] harness liveness/control passed
[ ] current behavior matrix is complete
[ ] surprising results are recorded, not rationalized away
[ ] every behavior has an owner/disposition
[ ] no open matrix cells remain, OR open cell split into new experiment
[ ] positive claim has positive evidence
[ ] non-claims are explicit
[ ] public reachability was measured
[ ] permanent conformance exists
[ ] relevant mutation kills permanent conformance
[ ] architecture is frozen absent new falsifier
[ ] migration is separate from architecture closure
[ ] historical record is preserved
```

---

# 24. Retirement checklist

```text
[ ] retirement decision was earned before deletion
[ ] all live references classified by category
[ ] operational guards read and tested
[ ] generic type/test invariants classified
[ ] dead generic machinery removed instead of synthetically preserved
[ ] live demo no longer imports deleted API
[ ] current docs no longer teach deleted API
[ ] tools/AI scorers/prompts no longer reward deleted API
[ ] historical records remain intact
[ ] zero-reference report is category-specific
[ ] public API diff matches expected disposition
[ ] test/type/lint/build are green
[ ] directly affected release gates are green
```

---

# 25. Performance checkpoint checklist

```text
[ ] clean rebuild
[ ] interleaved A/B
[ ] A/A control
[ ] warmup
[ ] repeated samples
[ ] robust statistic
[ ] equivalent-operation matrix
[ ] raw vs featured configuration
[ ] scaling sizes
[ ] consumer fan-out where relevant
[ ] retained memory
[ ] peak memory
[ ] quiescence protocol
[ ] unresolved cells quarantined
[ ] claim states scope and shape
[ ] gate self-test mutation proven
```

---

# 26. Release checkpoint checklist

```text
[ ] migration closed
[ ] deleted API live refs = 0
[ ] demo coverage matrix complete
[ ] demo negative gate clean
[ ] performance-proof methodology clean
[ ] full release gates run on clean committed HEAD
[ ] gate self-tests proven
[ ] package/tarball consumers pass
[ ] framework consumer fixture passes
[ ] public docs match published surface
[ ] advisory findings reproduced or dismissed from fresh evidence
[ ] production consumer migration passes
[ ] release claims matrix has no unsupported statements
```

---

# 27. The deeper philosophy

The protocol can be summarized in five ideas.

## 27.1 Architecture is an ownership theorem

Good architecture is not primarily about file organization. It is an argument that each semantic responsibility has the smallest truthful owner and that no two layers are pretending to own the same thing.

## 27.2 Falsification is faster than persuasion

A precise counterexample can settle a debate that would otherwise produce pages of design argument.

## 27.3 Corrections increase confidence

A process that never records being wrong is almost certainly hiding uncertainty.

The strongest parts of the SignalTree program were often the moments where a claim was narrowed or reversed because a better discriminator showed the truth.

## 27.4 Tests are executable epistemology

A permanent test is not merely regression prevention. It is a machine-executable statement of why the architecture believes a property is true.

## 27.5 Freeze is what converts research into engineering

Discovery without freeze becomes endless redesign. Freeze without falsification becomes dogma.

ADSP uses both:

```text
FALSIFY aggressively before closure.
FREEZE aggressively after closure.
```

## 27.6 Rigor is a budget, not a virtue signal

A method that cannot say when it is overkill will eventually be ignored. ADSP's purpose is to spend rigor where semantic ambiguity and consequence justify it, not to maximize ceremony.

The correct amount of process is the smallest amount that can still expose the failure mode that matters.

---

# 28. Operationalizing ADSP as an AI coding-agent Skill

ADSP is well suited to implementation as a Skill because its strongest parts are structured constraints rather than prose preferences. A Skill should make the protocol easier to invoke without forcing P2/P3 rigor onto every routine change.

## 28.1 Skill responsibilities

A useful ADSP Skill should:

1. classify the requested work into P0-P3 rigor;
2. require a property and falsifier before production changes at P1+;
3. surface applicable matrices rather than every matrix;
4. enforce STOP when a preregistered falsifier fires;
5. require positive controls and harness validation;
6. track `CARRIED`, `VACUOUS`, and `ORPHANED` invariants during retirement;
7. require REACH/READ/DISCRIMINATE before promoting mechanism claims;
8. record corrections without rewriting historical records;
9. maintain freeze/reopen state;
10. distinguish permanent conformance from discovery archaeology; and
11. refuse to treat greenfield work as incumbent-code transcription.

## 28.2 Skill outputs

The Skill should be able to emit/update:

- experiment card;
- falsifier matrix;
- ownership disposition;
- correction ledger entry;
- freeze/reopen ledger entry;
- permanent-conformance checklist;
- migration carrier disposition;
- release claim matrix; and
- machine-readable rulebook state.

## 28.3 Human decision boundaries

The Skill should automate evidence discipline, not architecture authority. It may block an invalid claim or flag an orphaned invariant, but ownership decisions, public contract freezes, and deliberate changes to product semantics remain explicit engineering decisions.

## 28.4 Avoiding process theater

A Skill implementation must honor the proportional-rigor profiles. Automatically generating a 14-matrix packet for a P0 helper change would make ADSP less usable and encourage ritual compliance instead of falsification.

The Skill should ask the minimum questions needed to make the current risk falsifiable, then escalate only when evidence requires it.

---

# 29. The Architecture Authority Flip

ADSP already knew how to falsify an architecture. It did not know **when to stop
letting the incumbent architecture vote.** This section closes that gap.

Discovery asks what the system _is_ and which semantics must survive.
Implementation asks how to realize the architecture we _chose_. Once the
architecture is frozen, the relationship reverses:

> **ARCHITECTURE AUTHORITY FLIP.** After the freeze, incumbent implementation is
> no longer an authority. It is evidence, fixtures, algorithms and historical
> context only.

```text
DISCOVERY            incumbent implementation = primary evidence
                     proposed architecture    = hypothesis
      ↓ falsify / measure / solidify
ARCHITECTURE FREEZE  contracts, invariants and ownership become authoritative
      ↓ AUTHORITY FLIP
IMPLEMENTATION       frozen architecture      = authority
                     incumbent implementation = evidence only
      ↓
VALIDATION           attack the new implementation; reopen architecture ONLY on
                     demonstrated contradiction
```

Without an explicit transition, an agent keeps using discovery behaviour during
implementation and slowly **reconstructs the old system**.

## 29.1 The three complementary rules

```text
DISCOVERY RULE      REAL BEHAVIOR MAY NOT BE DISMISSED WITHOUT CLASSIFICATION.

AUTHORITY-FLIP RULE AFTER ARCHITECTURE FREEZE, INCUMBENT BEHAVIOR HAS NO CLAIM
                    ON THE TARGET UNLESS THE FROZEN CONTRACT ADMITS IT.

IMPLEMENTATION RULE ENFORCE THE FROZEN OWNER UNTIL REQUIRED FUNCTIONALITY
                    DEMONSTRATES THAT OWNER CANNOT CARRY IT.
```

The diagnostic question, asked out loud before reasoning:

> **Am I currently learning what the system must be, or implementing what we
> already decided it will be?**

If the answer is implementation, any sentence beginning _"the old implementation
needs…"_ triggers scrutiny.

## 29.2 Mandatory question before preserving any incumbent mechanism

> **What frozen requirement would be violated if this mechanism disappeared
> completely?**

These do NOT qualify: _tests use it · the old code needs it · it contains useful
behavior · we haven't found its successor · it was previously important._

Valid answers name a requirement, not a mechanism — and then you preserve the
REQUIREMENT, not necessarily the mechanism.

## 29.3 ARCHITECTURE-OVERRIDE detection

Flag the work if any appear during implementation:

```text
1  OLD-OWNER PRESERVATION      "this subsystem has meaningful behavior, so it
                               must survive or find a successor"
2  REPRESENTATION VETO         "the current implementation stores X this way, so
                               the replacement must accommodate that shape"
3  TEST-LED DESIGN             "these incumbent tests fail, so the architecture
                               needs more machinery" — classify the tests first
4  PARALLEL-OWNER CREATION     a failure in an existing authority spawns another
                               ledger/history/projection/lifecycle owner
                               ⚠️ FLAG HARD — repair the frozen owner first
5  RELOCATION NOT RETIREMENT   old behavior moved to a new module merely so
                               deletion can proceed
6  COMPATIBILITY-BY-INERTIA    an old API survives because existing code depends
                               on it, despite a frozen canonical surface
7  DIFFICULTY AS FALSIFICATION "this is hard to implement cleanly, maybe the
                               architecture was wrong" — difficulty is not
                               falsification
8  MECHANISM BEFORE OWNER      a mechanism is proposed before identifying which
                               frozen owner is responsible
9  ABSENCE AS REQUIREMENT LOSS "the old implementation did not support this
                               cleanly" — greenfield exists to escape that
10 PRESENCE AS REQUIREMENT     "this behavior exists and is tested" — presence
                               proves existence, not admission
```

## 29.4 Phase declaration

Every substantial work unit declares its mode, so leakage is catchable:

```text
ADSP MODE:  DISCOVERY | SOLIDIFICATION | IMPLEMENTATION | ARCHITECTURE-REOPEN
```

```text
DISCOVERY        incumbent behavior presumed meaningful until classified;
                 architecture aggressively challenged; real behavior cannot be
                 casually discarded
IMPLEMENTATION   frozen architecture presumed correct until falsified; incumbent
                 behavior presumed non-binding unless admitted; representation
                 freely replaceable; old machinery deletable wholesale
```

## 29.5 The ARCHITECTURE-REOPEN gate

Enforcement must not become dogma. Implementation may return to discovery ONLY
with all six:

```text
REQUIRED        a previously admitted requirement is threatened
REPRODUCED      a deterministic failing discriminator exists
OWNER           the frozen architecture identifies who should provide it
ATTEMPTED       reasonable compliant implementations were tried
FALSIFIED       they fail because of the ARCHITECTURE, not the representation
CONTRADICTION   the smallest incompatible frozen claims are stated
```

Anything less: keep implementing.

## 29.6 The canonical example — `loader`

Discovery correctly found that `loader` was not semantically empty: it held
stale/fresh state, SWR, tag invalidation, scoped cache entries and eviction.
Deleting it then, as "useless", would have been bad discovery.

After the architecture solidified — relationship authority to `Link`, entity
topology to `entityMap`, cache/query policy outside core — the correct
implementation conclusion was that **`loader`'s representation had no surviving
owner, so it should be deleted.**

The mistake was carrying a DISCOVERY rule across the flip:

```text
discovery rule carried wrongly   real behavior needs a successor
implementation rule required     only ADMITTED GREENFIELD SEMANTICS need one
```

The same failure recurred immediately afterwards: a red rollback suite prompted
designing a second causal ledger, when the frozen answer was already _one causal
system_ — and the real repair was a corrected admission criterion inside the
existing owner, plus a bounded projection. Pattern 4 above exists because of it.

## 29.7 Every negative observation needs a positive control

> **A MUTATION NEEDS ITS OWN POSITIVE CONTROL.**

Broader than mutation testing. It governs every observation whose CONCLUSION IS
AN ABSENCE:

```text
mutation testing     a mutation that "survives" proves nothing until you have
                     shown it changed behaviour at all
grep audits          a zero-match search proves nothing until the same pattern
                     is shown to match a known positive
reachability         "not exported" needs a symbol you KNOW is exported to
                     resolve through the same extractor
dependency checks    "no consumer" needs a known consumer to be found
status reconciliation "no closure commit" needs a known closure to be located by
                     the same query
```

The shared failure mode:

> **THE OBSERVATION ITSELF MAY HAVE DONE NOTHING.**

Two instances, one session: a mutation filtering `effect.origin` on a type with no
`origin` field passed 13 tests while changing nothing; and a reachability grep
reported `entityMap` and `link` unreachable, which the controls immediately
exposed as a broken pattern rather than a finding.

## 29.7a Casts invalidate type-evidence

> **CASTS INVALIDATE TYPE-EVIDENCE UNLESS THE CAST ITSELF IS THE SUBJECT UNDER
> TEST.** `as never`, `as any` and `as unknown as X` in a fixture do not merely
> silence a complaint — they remove the check whose result you are about to
> report.

Measured: a carrier passed `tree.$ as never` to an API whose parameter type
already rejects `TreeNode`, hit a runtime failure, and produced a report of a
public-contract defect that did not exist. Without the cast the call does not
compile, which was the contract working.

Same family as the no-op mutation and the broken absence grep. The unifying
statement:

> **EVIDENCE INFRASTRUCTURE MUST ITSELF BE DEMONSTRATED CAPABLE OF OBSERVING THE
> PROPERTY IT CLAIMS TO PROTECT.**

## 29.7b Two rules from tightening a proof

> **A TEST TITLE IS A CLAIM.** If the fixture does not deterministically produce
> the condition the title names, the test is mis-specified even when its
> assertions pass. That is how a characterization row masquerades as a
> discriminator.

> **DO NOT RE-WRAP AN ALREADY-CLASSIFIED DOMAIN FAILURE AT THE SAME AUTHORITY
> BOUNDARY.** If an inner error already carries the authoritative classification,
> preserve it. A higher layer may add context only when it represents a
> genuinely DIFFERENT failure domain.

Both were earned in one repair. Removing a vacuity escape from a rollback carrier
revealed that the fixture produced a different refusal kind than its title named,
and that a refusal thrown deeper was being caught and re-wrapped at the same
boundary — producing a doubled message that a constant error string had hidden
for as long as it existed.

## 29.7c Test the claim at the boundary the claim is about

> **TEST THE CLAIM AT THE BOUNDARY THE CLAIM IS ABOUT.** A causal claim is tested
> at the causal owner. A subject claim is tested at the subject. A public-export
> claim is tested THROUGH the public export.

The packaging analogue of the subject-address rule, and it has its own corollary:

> **PUBLIC-BOUNDARY CARRIER RULE.** A claim about PUBLIC REACHABILITY must cross
> the public boundary.
>
> Package-internal relative imports can prove runtime semantics, causal
> behaviour and implementation invariants. They CANNOT prove package export
> existence, barrel reachability, subpath reachability, or external type
> usability. A spec that imports the implementation directly is not evidence that
> the public API exists.

For a public KEEP: import through the published package or subpath — or through a
deliberate source-barrel alias that exercises the same boundary — and the carrier
must FAIL when the export is removed.

⚠️ A CLASS OF FALSE-NEGATIVE TEST, not one bad spec. A package whose every spec
imports relatively has no test that can observe its own export list: deleting a
re-export leaves the suite green while breaking every external consumer. Measured
— removing `toWritableSignal` from a barrel left its three carriers passing,
because they imported the implementation path.

The module-boundary lint is right for ordinary code and is also why the blind spot
exists. So:

```text
ordinary package code      MUST obey module-boundary lint
public-boundary carrier    MAY cross through the package barrel, exception
                           documented, and only for that purpose
```

That is not weakening the rule. It is testing the thing the rule exists to stop
internal code from depending on.

## 29.7d A gate register is not its members

> **A GATE REGISTER IS NOT ITS MEMBERS.** Running components opportunistically is
> not equivalent to proving the release gate as a composed artifact.

Measured at a release freeze: every individual gate had been run during the
preceding batches, and running all 52 together found EIGHT failures — spec files
that never typechecked because the runner transpiles without checking, four
exports orphaned by deletions, two probes left stale by a landed semantic flip,
and two shipped capabilities missing from the package README. Every one was
reachable the whole time; nothing had executed the register end to end.

## 29.7e Stage only reviewed paths

> **STAGE ONLY REVIEWED PATHS.** A commit boundary cannot certify review if the
> staging operation can include material never inspected.

The version-control form of the same evidence problem. Measured: a blanket
`git add -A` swept an untracked 2,420-line document and a 4 MB binary into a
commit about something else entirely, carrying 25 unresolvable links that no gate
could see until one was pointed at them.

## 29.7f Read the artifact before deriving the question

> **READ THE ARTIFACT BEFORE DERIVING THE QUESTION.** A phase that NAMES a
> problem is not evidence the problem is OPEN.

The active form of §29.8. Checking the code and the log first is not the same as
checking them eventually: a framing built on a stale premise survives every
subsequent step, because each step is then validated against the FRAMING rather
than against the artifact.

### A controller is an artifact too

> **THE RULE APPLIES TO PLANS, NOT ONLY TO PHASES.** A sequencing document is
> read as authority precisely because it is the controller — which is what lets
> its stale premises survive unexamined.

Measured: a release controller's next checkbox was "publish the release
candidate", and executing it was nearly correct procedure and entirely wrong,
because the plan predated a frozen decision to replace the primary public
grammar. The phases were all satisfied; the SEQUENCE they implied was not.

Before executing a planned step, ask what the plan ASSUMED and whether a later
ruling changed it.

### The required first move on any reopened item

```text
OLD RECORD SAYS OPEN
        ↓
DO NOT begin derivation
        ↓
inspect HEAD code · permanent tests · gate registrations · later rulings · git
        ↓
reconstruct CURRENT status
        ↓
only THEN formulate the unresolved question
```

Without this ordering, ADSP can be extremely rigorous about answering a question
that ceased to exist.

Measured in one workstream: four separate items — a semantic flip, a correctness
family, a subsystem disposition, and a metadata seam — were each already resolved
in the code while being re-derived from the record. In the third case the
re-derivation also measured the WRONG COMPONENT, selecting between two outcomes
using an observation that could not distinguish them.

## 29.8 A corollary for long-lived records

An append-only architecture record accumulates statements that later entries
supersede. Reading such a document top-down produces confident, stale answers.

> **A LONG APPEND-ONLY RECORD IS A HISTORY, NOT A STATUS.** Before treating any
> recorded "OPEN" as current, check the code and the commit log.

# Appendix A — Blank matrix templates

## A.1 Consumer inventory

| Symbol | Public root | Secondary/deep | Prod | Demo | Docs | Tools | Tests | Historical | Disposition |
| ------ | ----------: | -------------: | ---: | ---: | ---: | ----: | ----: | ---------: | ----------- |
|        |             |                |      |      |      |       |       |            |             |

## A.2 Behavior matrix

| Behavior | Mechanism | Observable contract | Final owner | Preserve? | Proof |
| -------- | --------- | ------------------- | ----------- | --------: | ----- |
|          |           |                     |             |           |       |

## A.3 Falsifier matrix

| Hypothesis | Falsifier | Control | Result | Interpretation |
| ---------- | --------- | ------- | ------ | -------------- |
|            |           |         |        |                |

## A.4 Ownership matrix

| Responsibility | Candidate owners | Needed information | Lifecycle owner | Decision | Why |
| -------------- | ---------------- | ------------------ | --------------- | -------- | --- |
|                |                  |                    |                 |          |     |

## A.5 Migration matrix

| Caller | Old behavior | Final expression | Semantic delta | Tool/doc/demo impact | Status |
| ------ | ------------ | ---------------- | -------------- | -------------------- | ------ |
|        |              |                  |                |                      |        |

## A.6 Performance matrix

| Operation | Semantics | Size | Raw | Featured | Comparator | A/A spread | Shape | Claim status |
| --------- | --------- | ---: | --: | -------: | ---------: | ---------: | ----- | ------------ |
|           |           |      |     |          |            |            |       |              |

## A.7 Gate matrix

| Gate | Claim | Mutation | Expected fail | Actual | Blind? | Action |
| ---- | ----- | -------- | ------------: | -----: | -----: | ------ |
|      |       |          |               |        |        |        |

---

# Appendix B — Example decision flow

```text
1. Candidate API looks redundant.
2. Inventory public reachability and real consumers.
3. Build behavior matrix.
4. Ask what becomes impossible if deleted.
5. Identify strongest unique-seeming behavior.
6. Build falsifier against that behavior.
7. Gate the falsifier with a known-bad control.
8. Run.

   If behavior reproduces naturally elsewhere:
       DELETE candidate, preserve lesson.

   If a unique capability appears:
       STOP deletion.
       Assign capability to a new owner experiment.

   If architecture is clear but migration is broad:
       FREEZE architecture.
       Create migration matrix.

9. Promote winning semantics to permanent conformance.
10. Consolidate archaeological tests.
11. Freeze absent new falsifier.
```

---

# Appendix C — Vocabulary

**Architectural owner** — the smallest layer that has the information and lifecycle authority needed to enforce a semantic property.

**Falsifier** — an observation that would make a hypothesis false.

**Control** — a probe that proves the experiment/harness can distinguish the relevant outcomes.

**Causal authority** — responsibility for authored/committed state transitions rather than merely observing results.

**Operational knowledge** — implementation logic necessary for correct behavior but not sufficient to justify the abstraction that currently contains it.

**Solidification** — converting a discovered property into a permanent contract, conformance test, non-claim boundary, and freeze state.

**Archaeological test** — a test/harness whose original decision value may have been subsumed by later production-facing conformance.

**Quarantine** — explicit exclusion of unresolved evidence from claims until its harness or interpretation is localized.

**Freeze** — a rule that a closed contract is not redesigned without new falsifying evidence.

**Migration** — caller/doc/tool/demo adaptation after architecture has already been decided.

**Non-claim** — an explicit statement of what the evidence does not establish.

---

# Final principle

The reusable essence of the system is this:

> **Do not ask an architecture to prove that your preferred design is correct. Ask it to survive the strongest experiment you can devise to prove that it is wrong. Then preserve the experiment, the correction, the boundary, and the reason - not merely the code that happened to win.**

For greenfield implementation, add:

> **Preserve the residue - the contracts, evidence, ownership, and conformance - not the historical implementation that happened to reveal it.**

That is how discovery becomes institutional knowledge instead of a one-time heroic effort.
