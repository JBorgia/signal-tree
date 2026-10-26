# A1 installed-operation experiment: rejected for integration

October 26, 2026. Experimental baseline: `f01ed39a7df8a5de185ebec0773e09e36537dacb`.
A0 design checkpoint: `4ed3b6094404f59b940e601626408dbbadbec588`.
Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
This checkpoint preserves rejected runtime and unchanged falsifiers; it is not an
accepted integration, a release candidate, or a resumption of historical B.

## Decisive boundaries

1. **Native ordinary membership is missing.** Ordinarily omit retained y=7;
   inspection physically restores y=99; a transaction writes y=7. In both no-Link
   and default-Link controls, transaction inspection has no changes and rollback
   leaves y present. Ordinary-absence restoration is the prewritten A0-derived
   expectation, not a claim that a production comparator passed it. Scalar
   ordinary-value storage cannot substitute for ordinary presence. A private Link
   mask must not become native rollback authority.
2. **Completed installation is not completed delivery.** Mixed undo restores
   right rows A11/B12. Its first row callback writes A777. Physical final state
   preserves A777/B12, but a later outer prepared notification makes the final
   outbound payload A11/B12. This is ordinary public input. It reproduces with
   frozen f01 Link plus the paired-source/adapter overlay and independently in
   combined A1 through a permanent Nx regression. It is a recurrence in the
   newly covered heterogeneous live-row delivery route, not evidence that an
   unmigrated member writer failed. No downstream filtering repair was applied.
3. **Invalidation containment is incomplete.** A controlled private-port throw
   after the first installed row's invalidation prevents the second row's
   invalidation. Native restoration and exact primary-error identity pass. This
   is fault-injection evidence, not a demonstrated ordinary stale-cache trigger.

The first issue needs a source-owned P/O presence representation with explicit
installation, capture, inverse and retirement rules. The second needs an
operation-level delivery rule that admits the whole older transition before
callback-authored newer work can be overtaken by remaining older notifications.
Merely sequencing per-row publishers is insufficient. Revision validation is an
alternative only if it preserves exact selected ordinary participation; rereading
physical display would repeat the inspection leak. These are design requirements,
not newly implemented mechanisms or authorization to change callback semantics.

## Useful results and limits

- Scalar corrected vector: 14 passing controls; independent scalar vector: 4;
  source installation fault/reentry vector: 10. These are separate vectors, not
  an additive unique-test total.
- The current membership vector has 17 passes and 3 failures, including the
  no-Link/native responsibility discriminators. Earlier 18-case first red is
  retained unchanged.
- Paired composition lane: 73 passing controls and scoped independent review.
- Heterogeneous consumer affected vector: 292 passing controls, including the
  original 22 membership reversals. Later reentry and invalidation falsifiers
  independently block acceptance; the passing vector is not erased.
- Original in-flight/settlement controls: 9 passes at their recorded identity.
- Source type checks and baseline-ratcheted spec-types have recorded results.
  A passing ratchet does not mean all historical spec diagnostics disappeared.
- Full kernel/framework qualification, builds, artifact costs, runtime costs and
  collectibility were not run for A1. No prior checkpoint results are inherited.
- Aggregate declarations remain a separate pending owner decision. The scalar
  API's approved scope cannot silently become aggregate per-fact certification.
  Hidden-input omissions remain application misuse, never a safety-pass count.

## Evidence and exact replay

Full logs, first failures, source manifests, immutable lane sources, reviews and
probe builders are preserved under `/private/tmp/link-a1-evidence` and in the
readiness archive for this checkpoint. That archive records its own SHA-256.
No runtime change follows the final two independent review failures.

Use Node 24.15.0 and pinned pnpm 10.17.0 in this checkout. Run focused failures:

```sh
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=src/lib/a1-installed-publication.spec.ts --testFile=src/lib/internals/causal-runtime/heterogeneous-reentry-publication.spec.ts --testFile=src/lib/internals/causal-runtime/heterogeneous-independent-invalidation.spec.ts --skip-nx-cache
```

This grouped command is a replay recipe; the preserved first failures ran in
their separately recorded commands, not as this combined vector. The raw public
overlay probe is `heterogeneous/build-reentry-probe.cjs` followed by
`heterogeneous/reentry-probe.mjs`; its loaded-source manifest identifies all inputs.
The permanent combined A1 regression does not require that overlay.

No activation, public API expansion, budget increase, merge, push, tag or release.
