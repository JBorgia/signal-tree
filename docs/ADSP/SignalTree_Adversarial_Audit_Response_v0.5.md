# Adversarial Audit Response - SignalTree Strategy v0.6

**Date:** 2026-08-30  
**Reviewer posture:** antagonistic, falsification-first.  
**Evidence cut:** RC1 publication and repository audit through `7888fab9`.

## A. Verdict

**GO, NARROW THESIS.**

The engineering substrate is credible enough to justify commercial experiments.
The full Studio/Relay/Audit portfolio is not established. The thesis worth
betting on now is:

> SignalTree may make consequential client/application state materially easier
> to investigate by preserving authored-vs-realized truth, restoration,
> subject-lifetime, and causal-turn semantics without requiring a backend
> rewrite.

## B. Why the prior DEFER verdict changed

The v0.4 response relied on a 63/66 release snapshot and treated undo/redo as a
possible product failure. That evidence is superseded:

- release gates are 66/66 with zero known-red;
- the undo/redo failure was a stale benchmark harness, not a product defect;
- the public API is frozen around one constructor, one `$`, and singular
  `config.derived`;
- kernel and Angular packages are physically split and published;
- packed kernel neutrality and Angular native realization are proven;
- exact tarballs passed clean install, strict typecheck, runtime, registry
  download, and byte comparison;
- the production Angular consumer and browser smoke are green.

The prior response remains historical evidence of what would have blocked GO
under the old facts. It is not the current verdict.

## C. Strongest surviving thesis

SignalTree owns useful semantic distinctions that ordinary client stores and
backend observability do not naturally preserve together: intentional local
work versus external realization, restoration versus new authorship,
flush-bounded causal turns, and subject lifetime distinct from reusable address.
The commercial question is whether those facts materially improve a real
investigation at acceptable migration cost.

Authorship here does not mean identified actor identity. RC1 does not establish
principal, agent, approval, or authorization attribution.

## D. Immediate falsifiers

1. **`STATE-SEMANTICS-0`:** a competent conventional stack reaches an equally
   correct, complete, and inexpensive answer.
2. **`MIGRATION-WEDGE-0`:** useful value requires broad state/backend migration,
   event-sourcing conversion, or Relay.
3. **`PAID-PILOT-0`:** qualified prospects cannot name a recurring workflow,
   budget owner, or paid next step.
4. **Studio semantic core does not convert:** local investigation is useful, but
   nobody funds production ingestion, retention, search, or support.
5. **Instrumentation advantage disappears:** SignalTree does not reduce missing
   or misclassified transitions versus disciplined manual instrumentation.

## E. Experiment order

```text
1. STATE-SEMANTICS-0
2. MIGRATION-WEDGE-0
3. PAID-PILOT-0 / STUDIO-WTP-0
4. ATTRIBUTION-OWNER-0 - only if demanded
5. STATE-WHY-0 - only after attribution exists end to end
6. RELAY-VALUE-0 - only if distributed preservation recurs
```

Do not put actor attribution on the critical path. The first valuable question
may be “why does the client disagree with server truth, and what did undo
restore?”

## F. Required experiment instrument

The strongest causal investigation representation is currently internal. A
bounded diagnostic journal already projects turns, paths, participation,
origin, transaction correlation, subject/position IDs, and before/after values,
but public restoration history and DevTools exports do not expose the same
coherent record.

Use that internal projection in an unpublished demo or Studio prototype for the
experiment. Do not export it or change the frozen v15 API merely for convenient
annotations. A public investigation contract must be earned by user evidence.

## G. Product disposition

- **Enterprise Adoption:** immediate paid wedge.
- **Causal-state pilot:** immediate commercial discriminator.
- **Studio semantic core:** immediate product experiment.
- **Studio Cloud:** separate recurring-software bet.
- **Attribution:** deferred until customer evidence requires “who/under what
  authority?”.
- **Relay:** deferred until distributed preservation repeatedly adds value.
- **Audit / Verified Audit / agent governance:** parked.

Studio may be the entire company. Relay may add little. Audit may never exist.
Those are successful outcomes if selected by evidence.

## H. Economics

The operating question is not the detailed $10M portfolio composition. It is:

> Can SignalTree close a $15k-$30k one-workflow pilot and convert one into
> recurring Studio or support spend?

Detailed Relay/Audit/Verified Audit pricing remains appendix-level option
valuation, not roadmap or hiring authority.

## I. Moat after copying

The credible future moat is:

```text
semantic model
+ easiest brownfield adoption
+ best causal investigation workflow
+ customer failure corpus
+ operational knowledge
+ integrations
+ customer history/data
+ trust
```

Most of these are not accumulated yet. Provenance prevents easy erasure from the
story; chronology alone does not create buyer leverage.

## J. Protection and licensing

Apache-2.0 is already published for RC1. Perform bounded counsel review of
ownership, trademark, licensing, and future disclosures. Preserve basic release
provenance. Do not build a patent program, elaborate provenance platform, or
partner-defense apparatus before semantic and paid-pilot evidence.

## K. Current RC findings

Two bounded RC/DX defects were independently reproduced after publication:

1. Angular declared `sideEffects: false`, allowing a side-effect-only import to
   be removed before realization installation. The repository fix removes that
   false declaration and passes the esbuild falsifier.
2. Kernel declaration JSDoc still taught deleted `.with()` construction. The
   repository fix teaches declarative enhancer configuration.

Neither finding reopens v15 semantics or package topology.

## L. Kill criteria

- Narrow or stop the thesis if `STATE-SEMANTICS-0` fails.
- Narrow or stop brownfield positioning if `MIGRATION-WEDGE-0` fails.
- Stop commercial build if qualified prospects will not fund a pilot.
- Keep Relay parked if Studio-only semantics explain the incidents.
- Keep Audit parked absent a qualified security/compliance buyer and an earned
  evidence model.

The next information worth more than another strategy revision is whether an
engineer performs materially better on a real incident and whether an
organization pays for that outcome.
