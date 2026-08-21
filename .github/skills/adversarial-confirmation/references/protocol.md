# Adversarial Confirmation Protocol

This reference expands the portable protocol used to prevent false certainty in
architecture and product-surface decisions.

## Vocabulary

**Frozen premise**: A quoted input the row may reason from. If it is paraphrased,
it is not frozen.

**Product decision**: A human-authoritative product/DX premise. It is allowed to
settle what the product promises, but must be cited as a decision, not as a theorem.

**Candidate**: The function being tested. It must name an observable semantic
property, not an incumbent mechanism.

**Carrier**: The mechanism, data structure, public spelling, or internal field that
might implement the function. Carriers do not survive just because the function does.

**Opposite contract**: The strongest coherent world where the candidate is absent.
It must not decide the question by stipulation.

**Absence witness**: A demonstration that some or all workflows can be handled without
the candidate. It is not a recommended design.

**Normalized rival packet**: The stripped form of a rival claim used for defender
pass 2.

## The Layering Test

Classify outputs as one of:

```text
KP  KERNEL PRIMITIVE
KA  KERNEL-SUPPORTED ADAPTER
AS  AUTHORING SUGAR
AR  APP RESPONSIBILITY
LC  LEGACY COMPATIBILITY / DELETE CANDIDATE
⚠   UNPLACED
```

Use these meanings:

- `KP`: Lower layers cannot supply the information. The kernel must represent it.
- `KA`: The kernel supplies facts or seams; a replaceable adapter owns the feature.
- `AS`: Already-surviving primitives can express it; this is authoring convenience.
- `AR`: The application owns the function.
- `LC`: Current physical residue, not a future commitment.
- `⚠`: Open semantic question. Do not silently convert to app responsibility.

## Candidate Hygiene

A candidate is bad if it is either incumbent-laden or function-anonymous.

Bad incumbent-laden examples:

```text
turn id must survive
causal attribution must be retained
transaction object must coordinate effects
```

Bad function-anonymous examples:

```text
some semantic fact must be retained
some coordination semantics must exist
the container must own something about acceptance
```

Good examples:

```text
one user-recognizable action should undo as one step
a failed mutation should leave no reachable state residue
an acquired member handle should not retarget to a later same-key occupant
a durable write should not get ahead of committed tree truth
```

## Defender Semantics

The defender is not merely a rebuttal reviewer and not a rubber stamp.

`SURVIVAL ESTABLISHED` is allowed only when all five are true:

```text
1. candidate names a concrete semantic function
2. positive burden is met by a concrete workflow/capability that becomes impossible or wrong without it
3. candidate supplies that function
4. actual normalized rival claims are defeated when raised
5. defence imports no unearned premise or incumbent carrier
```

If there are no rivals, requirement 4 must be disclosed. A lack of opposition does
not by itself strengthen the result.

## Reopening Conditions

A closed or underdetermined row may record reopening conditions. These are conditions,
not tasks.

Allowed:

```text
If an independently derived workflow later requires X, reopen this row.
```

Forbidden:

```text
Run this cheap check to see whether X exists.
Search the implementation for an example of X.
Benchmark current behavior to decide whether X is needed.
```

## When To Stop Reviewing And Build

Use this protocol until one of these happens:

- A product property is named clearly enough to falsify in code.
- The row is not openable as worded.
- The row is underdetermined under the current premises.
- A human product decision is required.

After a product decision, prefer a narrow implementation slice over more procedure.

## Importing Into Another Project

Copy:

```text
.github/skills/adversarial-confirmation/
```

Then run the skill whenever deciding architecture, API survival, DX feature
retention, kernel boundaries, or layer placement.

If the project has no `.github/skills` support, copy the folder under one of:

```text
.agents/skills/adversarial-confirmation/
.claude/skills/adversarial-confirmation/
~/.copilot/skills/adversarial-confirmation/
~/.agents/skills/adversarial-confirmation/
~/.claude/skills/adversarial-confirmation/
```
