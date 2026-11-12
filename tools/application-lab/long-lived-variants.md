# Paired v15 projection candidate

Registered before candidate timing, November 11, 2026. Reuse the ordinary
long-lived child workload and correctness checks without changing its generator.
Compare the baseline production bundle with the unchanged installed v15 Angular
facade rebuilt against the candidate kernel. Resolve all kernel entry points to
that one candidate; externalize Angular to the same installed producer runtime.
Bind every bundled input, output, metafile, candidate manifest and source diff.
This is an unpublished candidate, not the released v15.4.8 payload despite its
unchanged package version. It is not a cross-release comparison.

Five paired fresh-process samples per 1,000/10,000-row and 8/32-field profile,
with alternating baseline/candidate order. Use the actual per-child elapsed and
cumulative durations, full oracle checks and all heap checkpoints. Report paired
ratios and raw distributions; do not select favorable iterations or pool this
cohort with the earlier ordinary-store cohort. The ordinary comparison's A/A
controls are contextual and are not a confidence interval for this cohort.

The candidate changes collection projection, so the primary timing target is
`aggregate-200`; sparse writes, construction, retirement and field demand are
regression observations. A measurable aggregate gain is useful even if the
entire mixed workload does not clearly improve. Require source review and
semantic regression gates before adopting a runtime change. No public toggle or
semantic relaxation is introduced by this candidate.

```sh
node tools/application-lab/long-lived-variants.mjs /absolute/baseline /absolute/completed-cohort /absolute/candidate-kernel-package /fresh/variant-comparison
```
