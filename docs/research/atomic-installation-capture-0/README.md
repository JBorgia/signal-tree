# Atomic installation and responsibility capture — counterexample

**Disposition: the mixed scalar/entity capture-failure claim is falsified for
this candidate under controlled persistent entity-recorder failure. Do not
integrate the candidate as a systemic repair.** The narrower scalar result
survives the controls below. This does not refute the architectural idea or
establish a public-input trigger for the injected failure.

## Frozen question and artifact

Start: `19a5bd03` (Node 24.15.0, workspace pnpm 10.17.0).
No package source, public export, error policy, or compatibility contract changed.
Order/frontier work, size work and release qualification are outside this result.

At that revision, `docs/research/transaction-semantics-2/LAWS.md` says:

> Accept, reject, realization and failed settlement must not expose transient
> states that violate the semantic unit being settled.

> A failed settlement that preserves pending authority is either explicitly
> retryable or explicitly non-retryable, and may NEVER masquerade as a
> successful terminal settlement.

The candidate is the earlier `atomic-terminal-capture/atomic` research copy,
reconstructed against this base. Its nine source overlays were three-way merged
using `21143965` as ancestor. The one conflict kept both the base's
`placeFieldReversalsWhileRowsExist` ordering and the candidate's completion
selection. The later anchor-order repair is also preserved. Its native-location
overlay is byte-identical to the base and omitted from the patch.
[The patch](candidate.patch) freezes the resulting research artifact. It includes
experimental reentry refusal and fault probes, not production-approved policy.

## Executed counterexample

Plain numeric scalar and ordinary entity row, initially `[0,0]`:

1. Begin a transaction; write scalar `1`, then `rows.updateOne('A', {v: 1})`.
2. Inject an error before entity decomposition at `captureEffects`. It reaches
   the three capture entrances for this write. Containment permits the physical
   write to survive; this is a persistent recorder failure, not one exception.
3. `inspect()` refuses, but `rollback()` returns normally, leaves `[0,1]`, and
   retires pending authority to zero.
4. Another `rollback()` returns normally and leaves `[0,1]` again.
5. A subsequent clean transaction can still write and confirm `[2,2]`.

Both exact base and candidate exhibit this failure. Throwing `undefined` produces
the same candidate result. The no-fault candidate control restores `[0,0]`.
The defect is incomplete compensation falsely reported as success; no later
competing write explains the surviving entity value.

The independently executed variant omits `inspect()`, disables the fault before
rollback, and reads `__prepareTransitionTarget.readSource()` before demanded
reads. Physical entity value remains `1`, pending authority is zero, and retry
again succeeds without compensation. This rules out inspection side effects,
an ongoing settlement-time fault, and stale native cache as explanations.

These are internal fault-injection witnesses. They do **not** demonstrate that
ordinary numeric decomposition naturally throws, that a one-shot error loses
responsibility, or that a stock framework observer throws at this point. They do
not characterize transient observer coherence. The falsified claim is robustness
under the tested entity capture failure, not all normal mixed transactions.

## Why the scalar proof does not compose

The candidate prepares scalar record storage before `commitRecorded` installs
value plus record, with no callback between them. Its transaction preparer
explicitly excludes entity subjects. Entity replay capture still decomposes
post-install values through fallible capture paths. Captured scalar evidence can
therefore be complete while entity evidence is missing. Settlement's completion
witness establishes completion of the **known target**, not completeness of the
transaction's captured responsibility.

Moving installation before publication repairs the tested mixed publisher
failure, but cannot recover an entity effect absent from the target. This is
source-supported interpretation, separate from the executed results above.

## Bounded controls

The initial source-bundled matrix ran 21 candidate processes: 19 pass, two fail
(the `Error` and `undefined` entity-capture witnesses). The kernel process contains
eight individual controls. Exact-base capture and mixed publisher witnesses both
fail. [Raw result summary](evidence/summary.json) identifies every initial run;
assertion output and stderr remain alongside it, including the first failures.

Passing controls cover:

- Scalar equality failure/reentry, preparation failure/reentry, equal no-op,
  and value/record pairing; actual getter equality controls remain input-domain
  qualified as in the original experiment.
- Default neutral preparation and reentry; supported Solid freshness/reentry.
- Scalar rich-capture failure with returned-handle rollback, callback failure,
  publisher `Error`/`undefined`, and updater abort without phantom capture.
- Mixed scalar/entity rollback with injected inline publication failure: candidate
  fully restores `[0,0]`; base leaves a partial result.
- Supported native reentry causing refused automatic compensation, retained
  recovery authority, and explicit confirmation.

These are fresh source-bundled probes, **not** Nx package-suite results, typecheck,
performance evidence or release sign-off. No broad suite or build is warranted
for integration because the candidate is rejected, and production files are
unchanged. Existing failures and contracts are not converted to expected passes.

## Reproduce

From a checkout whose package sources match `19a5bd03`, with its dependencies:

```sh
node docs/research/atomic-installation-capture-0/run.mjs candidate mixed.mjs capture-error replay
node docs/research/atomic-installation-capture-0/run.mjs base mixed.mjs capture-error replay
node docs/research/atomic-installation-capture-0/run.mjs candidate mixed.mjs control replay
node docs/research/atomic-installation-capture-0/run.mjs candidate mixed-no-inspect.mjs capture-error replay
```

The first, second and fourth commands intentionally exit **1** on the unchanged
correctness assertions; the no-fault control exits **0**. The runner refuses to
overwrite a completed run: use a fresh final label for another execution.
`ST_PROOF_DEPS` may point to an installed workspace with the same lockfile;
`ST_PROOF_OUTPUT` selects a fresh evidence directory (default
`/private/tmp/st-atomic-capture-replay`). The runner reconstructs the patch only
under that directory, verifies loaded package sources against the base, and
records exact loaded-input and bundle hashes. Run probes sequentially.

First execution used `/private/tmp/st-atomic-proof-20261013/run.mjs`; complete
bundles and full manifests remain under its `runs/` directory. Repository
manifests preserve their hashes; [source input records](evidence/source-inputs.json)
retain the union of those original inputs. Reviewer evidence also remains at
`/private/tmp/st-atomic-review-20261013/`. Paths in raw output identify original
execution locations, not prerequisites for the portable replay.

## Independent review and closure

One independent reviewer first examined framing/source assumptions, then reran
base, candidate and no-fault control and added the no-inspection/physical-storage
control. The reviewer confirmed the bounded counterexample and cautioned against
calling persistent internal injection a public callback trigger. Those limits
are retained here. The transaction merge and identical native-location file were
checked; this is not a claim of broad candidate regression validation.

The result closes the requested bounded decision with a reviewed counterexample.
It earns no new architecture or integration. A future candidate would need a
concrete mechanism that preserves entity responsibility when rich capture fails;
that is a reopening condition, not additional work undertaken here.

Portable replay verification: all four commands above were executed from this
packet with label `portable-first`. The three counterexample commands exited 1
on the preserved state/terminality assertions; the no-fault command exited 0.
All four loaded-input stability checks passed. Replay artifacts are under
`/private/tmp/st-atomic-capture-replay/runs/`.

Packaging check: the first staged whitespace check flagged 19 blank context lines
in the unified patch. Suppressing the blank-line context prefix fixes that file
formatting issue without changing reconstructed source; reverse-application
validation passes. This was not a semantic test failure.
