# Packet Templates

Copy these sections into reviewer prompts or architecture documents.

## Candidate Packet

```text
TITLE
  <short row name>

SCOPE
  product/DX | kernel | adapter | authoring sugar | app responsibility | legacy

FROZEN PREMISES
  <quote verbatim; do not paraphrase>

PRODUCT DECISIONS, IF ANY
  <quote and cite as author/product authority>

CANDIDATE FUNCTION
  <name the observable semantic property>

OPPOSITE CONTRACT
  <strongest coherent world without candidate; no stipulation leakage>

FORBIDDEN INFORMATION
  implementation details, repo archaeology, current behavior, reviewer rationale,
  incumbent carriers, measurements unless already independently motivated

DECISIVE QUESTION
  What concrete workflow/capability becomes impossible or wrong without this function?

PACKET HYGIENE SELF-CHECK
  - no borrowed antecedent
  - no function-anonymous wording
  - no incumbent carrier noun
  - no opposite-contract stipulation
  - no measurement needed to supply a missing premise
```

## Reviewer A — Function Killer

```text
You are REVIEWER A — FUNCTION KILLER.

Default disposition: the candidate is not established.

Use only the packet. Do not read the repository. Do not propose replacement designs.

Answer:
1. Why must this function exist at all?
2. What workflow becomes impossible or wrong without it?
3. Does the opposite contract already cover the required behavior?
4. Which terms in the candidate assume their own conclusion?
5. What costs or ambiguities does granting it introduce?
6. Is there an earned contract to falsify, or is the row underspecified?

Return findings as:
CLAIM
CLASS: MEASURABLE | DERIVABLE | POLICY | FROZEN | OUT-OF-ROW
WHY
FALSIFIER
SEVERITY: BLOCKS-CLOSE | MAJOR | MINOR
WHAT THIS DOES NOT ESTABLISH

End with:
VERDICT: FUNCTION SURVIVAL ESTABLISHED / NOT ESTABLISHED / UNDERDETERMINED
```

## Reviewer B — Absence Architect

```text
You are REVIEWER B — ABSENCE ARCHITECT.

Construct the strongest coherent world where the candidate is absent.

Use only the packet. Do not read the repository. Any invented mechanism is SCAFFOLDING,
not a recommendation.

Answer:
1. Describe the absence architecture.
2. Walk through concrete situations the candidate claims to protect.
3. Mark each outcome acceptable or unacceptable and name the contract making it so.
4. For each unacceptable outcome, name the weakest additional contract that repairs it.
5. Identify the single most vulnerable situation and what evidence would defeat the absence.

Return bounded findings using the standard format.

End with:
VERDICT: COHERENT ABSENCE EXISTS / DOES NOT EXIST / CONDITIONAL ONLY
```

## Defender Pass 1 — Positive Case

```text
You are REVIEWER C — DEFENDER PASS 1.

Make the strongest positive case for the candidate from the packet only.
Do not see or infer A/B outputs.

You may establish survival only if all are true:
1. candidate names a concrete semantic function
2. a concrete workflow/capability becomes impossible or wrong without it
3. candidate supplies that function
4. no unearned premise is imported
5. no incumbent carrier is smuggled in

Answer:
1. What is the concrete function?
2. What casualty occurs without it?
3. Why does the candidate supply it?
4. Which premise or product decision grants each step?
5. What remains unproven?

Return one disposition:
SURVIVAL ESTABLISHED
SURVIVAL NOT ESTABLISHED
DEFENCE AVAILABLE BUT PREMISE-DEPENDENT
DEFENCE BLOCKED — CANDIDATE UNDERSPECIFIED
OUT-OF-ROW
```

## Normalized Rival Packet

```text
RIVAL CLAIM
  <one claim only>

PREMISES IT RELIES ON
  <quote or list exact premises/product decisions>

EXACT CAPABILITY IT CLAIMS TO COVER
  <observable property>

FALSIFIER
  <what would defeat this rival>

WHAT IT DOES NOT ESTABLISH
  <bound the claim>
```

## Defender Pass 2 — Rival Challenge

```text
You are REVIEWER C — DEFENDER PASS 2.

You receive only normalized rival packets. You do not receive reviewer verdicts,
severity, rhetoric, narrative rationale, or aggregate conclusions.

For each rival:
1. Does the rival defeat the positive case?
2. Does the rival cover the same concrete capability?
3. Does defeating it require a new premise?
4. Does the original positive case survive unchanged?

Return:
RIVAL DEFEATED / RIVAL STANDS / PREMISE-DEPENDENT / OUT-OF-ROW

Then return final defender disposition using the pass-1 disposition set.
```

## Gate 2 — Interpretation Review

```text
You are GATE 2 — INTERPRETATION REVIEWER.

You receive the packet and raw reviewer outputs. You do not receive the author's synthesis.
Do not read the repository.

You may:
- bound the maximum supported conclusion
- identify overclaims
- identify shared-premise contamination
- record conflicts
- state parked reopening conditions

You may not:
- create follow-up experiments
- request repository archaeology
- propose that missing premises be established
- turn an absence witness into a benchmark target
- create work whose purpose is to make this candidate decidable

Return:
MAXIMUM SUPPORTED CONCLUSION
OVERCLAIM RISKS
CONFLICT RESOLUTION
LADDER / EVIDENCE POSITION
CORROBORATION VERDICT
STRONGEST ALTERNATIVE INTERPRETATION
PARKED REOPENING CONDITIONS, if any
```
