# DX-NAMES-1 — outside check instrument

> **WITHDRAWN — NOT REQUIRED. Kept as a record and as a reusable pattern.**
>
> This instrument was built when the remaining question was framed as a pure DX
> tie that internal evidence could not settle. Two later results superseded that
> framing: the reference-frame decision (DX-NAMES-1.4) gave `external` a precise
> meaning, and the `apply` isolation test (DX-NAMES-1.2) showed the longer form
> demonstrates no independent semantic value. When two public forms express the
> same primitive, the longer one has to earn its extra vocabulary; `apply` did
> not.
>
> The topological-ambiguity concern it was built to measure is answered by
> precedent rather than by survey: a library may define a term of art, and
> `transaction`, `effect`, `signal`, `subject`, `computed` and `reducer` all
> require definition too. What matters is whether the definition is coherent and
> generative rather than a list of exceptions. This one is.
>
> The risk did not disappear — it became a DOCUMENTATION OBLIGATION, discharged
> in `external()`'s first JSDoc line and in docs that teach the decision instead
> of enumerating sources.

**Purpose:** break one pure-DX tie that internal analysis cannot settle.
**Not testing:** anything else. `incoming`, `acquired`, `realize`, `received`,
`setExternal` and the rest are closed for this round.

**Send this file to participants? No.** It contains the answers. Use
[the participant script](#participant-script) only.

---

## Who to ask

5–8 developers who write TypeScript, ideally Angular, and who **have never used
SignalTree**. Screen for that explicitly — one participant who has read the API
docs invalidates their own retrieval answer.

TruckTrax colleagues are a natural pool: Angular daily, and unfamiliar with this
library.

## Arms — counterbalance the order

Assign alternately. The only difference is which name is listed first in Q2.

```text
ARM 1   external()      then  applyExternal()
ARM 2   applyExternal() then  external()
```

## Rules for the person running it

1. **Give the invariant once, verbatim. Do not elaborate.**
2. **Do not explain the worker distinction before Test B.** Otherwise the test
   measures whether they can repeat an explanation, not whether the vocabulary
   works.
3. Do not signal that Test B has a right answer.
4. Ask Test B's "in your own words" question *last*, and write the answer down
   verbatim. It is the most informative single item in the instrument.
5. Test A comes before Test B, always — the trap would otherwise teach retrieval.

---

## Participant script

> SignalTree is a state library. It distinguishes writes the current operation
> **authored** from writes whose authoritative value came from **outside** that
> operation, and it wants you to mark the second kind.
>
> The distinction is about **causal authority — who owned the decision — not
> about threads, processes, workers or machines.**

That is the whole briefing. Nothing else.

### Test A — situational retrieval

> Here is code that fetches a customer and updates the store:
>
> ```ts
> api.getCustomer(id).subscribe(customer => {
>   // update SignalTree here
> });
> ```
>
> **A1.** Which API would you *expect* SignalTree to provide for marking this
> write? Pick one:
>
> - `external(() => { … })`
> - `applyExternal(() => { … })`
> - neither / something else — what would you expect instead? ______
>
> **A2.** Before you saw those options, what word came to mind? ______

*(A2 is unprompted retrieval. Record it verbatim even when it names something
already rejected — that is still evidence about what the situation cues.)*

### Test B — the trap

Show these one at a time, in this order.

> **B1.**
>
> ```ts
> const price = await pricingWorker.calculate(localInputs);
> tree.$.quote.total.set(price);
> ```
>
> Should this write use the external-state API? **yes / no / unsure**
> Why, in one line? ______

> **B2.**
>
> ```ts
> const reading = await sensorWorker.readSensor();
> tree.$.temperature.set(reading);
> ```
>
> Should this write use the external-state API? **yes / no / unsure**
> Why, in one line? ______

> **B3.** In your own words, what does "external" mean in this library? ______

---

## Scoring sheet

```text
participant   arm   A1 pick   A2 unprompted   B1   B2   B3 reasoning
                                              (no) (yes)  causal / topological
1
2
3
4
5
6
7
8
```

**B1/B2 correct answers:** B1 = **no** (the application delegated computation;
authority never changed). B2 = **yes** (another authority produced the
observation). Do not tell participants this.

**B3 is coded, not scored:** does the explanation talk about *who owns the
value / who decided it* (causal) or about *another thread, service, machine,
outside the app* (topological)?

---

## Pre-registered decision rule

Fixed before any data exists. No post-hoc reinterpretation.

```text
OUTCOME 1 — retrieval comparable, trap mostly passed
  A1 within ~1 participant either way, and B1 answered "no" by most
  -> CHOOSE external()
  `apply` has already failed to demonstrate independent semantic work
  (DX-NAMES-1.2), and `external` is shorter, matches the scope-gate voice of
  `undoable()` / `transaction()`, and keeps API -> metadata -> DevTools
  vocabulary continuous.

OUTCOME 2 — applyExternal materially better
  clearly better A1 retrieval, or clearly fewer B1 errors
  -> CHOOSE applyExternal()
  `apply` earns its word on evidence rather than on grammar speculation.

OUTCOME 3 — both names fail the trap
  B1 answered "yes" by most participants under BOTH names
  -> the REFERENCE FRAME SURVIVES; the public WORD does not.
  `origin: 'external'` stays as the internal term of art, and the door needs a
  public name that does not have to fight a topological reading. That reopens the
  door name — and only the door name — with a new, measured reason.

OUTCOME 4 — B3 reasoning is topological even where B1/B2 are right
  -> a warning, not a verdict. The word works by luck on these two cases and the
  next unusual source will break it. Ship the chosen name with the definition in
  the JSDoc's FIRST line, and treat the recipe docs as load-bearing rather than
  explanatory.
```

No statistical significance is claimed or needed. This breaks a tie between two
names with **no semantic difference between them**; a directional signal from 5–8
developers is proportionate to that question and would be over-claimed for any
other.

## What this cannot settle

```text
in scope       which of two names developers reach for, and whether "external"
               survives contact with its everyday topological meaning
NOT in scope   the reference frame (chosen on principle, DX-NAMES-1.4)
               the origin / participation enums
               any candidate rejected in DX-NAMES-1.0-1.4
```
