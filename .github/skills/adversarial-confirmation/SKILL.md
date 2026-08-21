---
name: adversarial-confirmation
description: 'Use when making architecture, product-surface, kernel-boundary, public API, DX, or feature-survival decisions. Runs an adversarial confirmation protocol with premise freezing, killer/absence/defender passes, normalized rival packets, and bounded synthesis to prevent premise laundering, incumbent leakage, and false certainty.'
argument-hint: 'candidate decision or feature area'
---

# Adversarial Confirmation

Use this skill when a project needs to decide whether a feature, architecture concept,
kernel responsibility, public API surface, or DX affordance should survive, move layers,
be redesigned, or be deleted.

This is a portable protocol. To import it into another project, copy this entire folder:

```text
.github/skills/adversarial-confirmation/
```

## What This Skill Prevents

- Turning current implementation vocabulary into architecture.
- Treating reviewer agreement as independent corroboration when the reviewers share premises.
- Converting missing premises into work queues, benchmarks, or repo archaeology.
- Letting absence witnesses become proposed designs.
- Letting defender failures or opposition failures automatically imply survival.
- Deleting product/DX value just because the kernel does not need the old machinery.

## Core Rules

1. **Quote premises. Never paraphrase them.** A packet must quote the frozen premises verbatim.
2. **Incumbent-neutral is not function-anonymous.** Avoid old carrier nouns, but name the observable semantic property being tested.
3. **A candidate must not borrow antecedents.** If it depends on another unearned function, do not open it as worded.
4. **An opposite contract must not stipulate the answer.** Remove `only`, `merely`, `nothing but`, and any clause that would count as a finding if a reviewer produced it.
5. **Missing premises are terminal for that row.** Do not measure or search the current implementation to supply them.
6. **Product decisions are allowed, but label them.** Record them as author/product authority, not as derivation results.
7. **Implementation resumes when the product property is named.** After a product decision, prefer the smallest falsifying implementation slice.

## Workflow

### 1. Freeze Inputs

Create a packet that includes:

- Frozen premises, quoted verbatim.
- Candidate function, stated without incumbent carriers.
- Opposite contract, checked for stipulation leakage.
- Row scope: product/DX, kernel, adapter, authoring sugar, app responsibility, or legacy.
- Explicit forbidden information: implementation details, repo archaeology, current code behavior, reviewer rationale.

Use [packet templates](./assets/packet-templates.md).

### 2. Hygiene Check Before Review

Reject or repair the packet before running reviewers if any are true:

- The candidate says `semantics`, `coordination`, `fact`, or `thing` without naming the observable property.
- The candidate assumes a sibling row's unresolved function.
- The opposite contract decides the disputed scope.
- The decisive question asks for a value standard, such as `independently valuable`, without saying who decides that value.
- The packet would need repo measurement to be meaningful.

### 3. Gate 1: Three Seats

Run independent passes. Withhold each seat's output from the others.

1. **Function Killer**: tries to show the candidate is not established or unnecessary.
2. **Absence Architect**: constructs the strongest coherent world without the candidate. All invented parts are scaffolding, not recommendations.
3. **Defender Pass 1**: makes an independent positive case from premises, candidate, and opposite contract only.

The defender may establish survival only as adversarial confirmation:

```text
SURVIVAL ESTABLISHED requires all five:
1. candidate names a concrete semantic function
2. a concrete workflow/capability becomes impossible or wrong without it
3. candidate supplies that function
4. actual normalized rivals are defeated in pass 2 when raised
5. no unearned premise or incumbent carrier is imported
```

Opposition failure alone is never survival.

### 4. Normalize Rivals

If the killer or absence architect raises rival claims or alternative absence constructions, normalize them before any defender pass 2.

Pass only:

```text
RIVAL CLAIM
PREMISES IT RELIES ON
EXACT CAPABILITY IT CLAIMS TO COVER
FALSIFIER
WHAT IT DOES NOT ESTABLISH
```

Exclude verdicts, severity, rhetoric, reviewer identity, aggregate conclusions, and narrative rationale.

### 5. Defender Pass 2

Give the defender only the normalized rival packets. Ask whether the positive case survives each rival without importing a premise.

Valid defender outcomes:

- `SURVIVAL ESTABLISHED`
- `SURVIVAL NOT ESTABLISHED`
- `DEFENCE AVAILABLE BUT PREMISE-DEPENDENT`
- `DEFENCE BLOCKED — CANDIDATE UNDERSPECIFIED`
- `OUT-OF-ROW`

### 6. Gate 2: Interpretation Review

Gate 2 receives raw outputs and the original packet, not the author's desired synthesis.

Gate 2 may:

- Bound the maximum supported conclusion.
- Identify overclaims and shared-premise contamination.
- Record genuine conflicts.
- State parked reopening conditions.

Gate 2 may not:

- Create follow-up experiments.
- Request repo archaeology.
- Propose that a missing premise be established.
- Turn an absence witness into a benchmark target.
- Create work whose purpose is to make this candidate decidable.

### 7. Record Disposition

Use the narrowest honest status:

- `SURVIVAL ESTABLISHED`
- `FUNCTION NOT ESTABLISHED`
- `UNDERDETERMINED — TERMINAL AS POSED`
- `NOT OPENABLE AS WORDED`
- `APP RESPONSIBILITY`
- `KERNEL PRIMITIVE`
- `KERNEL-SUPPORTED ADAPTER`
- `AUTHORING SUGAR`
- `LEGACY COMPATIBILITY / DELETE CANDIDATE`

Never report `not established` as `refuted`.
Never report `not openable` as a verdict on the function.

### 8. Return To Implementation

Once a product property is named or a product decision is made, stop adding procedure. Build the smallest implementation slice that can falsify the boundary.

Preferred loop:

```text
product decision
  -> smallest implementation slice
  -> focused falsifier
  -> validation
  -> update map/ledger only when code teaches something new
```

## References

- [Protocol reference](./references/protocol.md)
- [Packet templates](./assets/packet-templates.md)
