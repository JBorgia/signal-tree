# Framework-native leaf performance

Angular's production facade now exposes native `WritableSignal` leaves while the
kernel remains the canonical state, identity, equality, transaction, restoration,
and publication authority. This note records the experiment that selected that
shape over universal callable Angular locations.

The CPU and retained-memory results below are Angular-specific. They select the
Angular carrier architecture; they do not claim measured Vue or React speedups.
Vue ref interoperability and React hook behavior are validated by their package
tests and packed-consumer gates instead.

<!-- measured: node --expose-gc tools/bench-angular-leaf-strategies.mjs; raw samples in apps/demo/public/benchmarks/angular-native-vs-universal.json, angular-native-aa.json, and angular-native-vs-historical.json -->

## Artifacts and protocol

The primary comparison uses packed, independently installed production artifacts:

- universal Angular locations: commit `a8c34b2a`; Angular tarball SHA-256
  `9169d009...0ad433`; kernel tarball SHA-256 `f5ade269...f60c95`
- production native Angular signals: Angular tarball SHA-256
  `667daf3d...a5c928`; kernel tarball SHA-256 `e3f511a4...ae1ba1`

The historical comparator is commit `851f496e`, with Angular tarball SHA-256
`912e3d28...0c107e` and kernel tarball SHA-256 `3c0221b2...739da4`.
The raw JSON carries every full digest.

Each operation runs in fresh mirrored persistent workers. Call order alternates,
each artifact occupies each worker slot for half the samples, and each paired
point is the median of five trials. The recorded run uses 30 measured pairs after
five warmups. Operations run in isolation so construction does not deoptimize
scalar paths. An identical production-native A/A run exposes protocol noise.

A result is called clear only when its paired p10-p90 interval stays on one side
of zero and clears the A/A interval. Exact percentages are machine-local.

## Universal Angular locations versus native signals

Reproduce with `node --expose-gc tools/bench-angular-leaf-strategies.mjs` using
the artifact roots and provenance recorded in the raw JSON.

Node v24.3.0 on macOS arm64:

| Operation               | Universal |    Native | Paired median |    Paired p10-p90 | Native A/A p10-p90 | Reading                   |
| ----------------------- | --------: | --------: | ------------: | ----------------: | -----------------: | ------------------------- |
| Scalar read             |  14.55 ns |   3.29 ns |        -77.3% |  -77.7% to -76.8% |     -0.5% to +1.0% | Clear native improvement  |
| Scalar replacement      |  62.83 ns |  41.99 ns |        -33.3% |  -38.5% to -31.0% |     -8.4% to +4.5% | Clear native improvement  |
| Scalar derivation       |  70.60 ns |  43.17 ns |        -39.0% |  -43.2% to -36.0% |     -4.6% to +4.1% | Clear native improvement  |
| Angular fan-out 1       | 122.79 ns |  75.53 ns |        -37.0% |  -41.0% to -30.9% |     -8.6% to +6.6% | Clear native improvement  |
| Angular fan-out 10      | 475.54 ns | 350.50 ns |        -27.3% |  -28.9% to -23.3% |     -1.9% to +1.9% | Clear native improvement  |
| Angular fan-out 100     |   4.23 us |   3.10 us |        -27.5% |  -28.8% to -23.9% |     -6.2% to +9.3% | Clear native improvement  |
| Derived chain, depth 10 | 434.72 ns | 366.47 ns |        -15.5% |   -21.8% to -7.8% |     -2.2% to +4.6% | Clear native improvement  |
| Derived diamond         | 193.91 ns | 162.33 ns |        -20.7% |  -26.9% to -10.7% |   -16.3% to +19.7% | Overlaps control          |
| Construct 10 leaves     |  17.23 us |  19.61 us |         +9.8% |   -0.7% to +20.5% |    -11.5% to +6.8% | Inconclusive              |
| Construct 100 leaves    | 108.83 us | 128.43 us |        +17.5% |   +9.9% to +32.4% |     -4.0% to +3.7% | Clear native overhead     |
| Construct 1,000 leaves  |   1.83 ms |   2.45 ms |        +30.8% | +19.39% to +44.1% |  -12.3% to +19.38% | Clears control by 0.01 pp |

Native realization wins the repeated application hot paths. Large-tree
construction is the retained cost and remains an optimization target; the result
does not justify hiding it inside an aggregate score.

## Retained memory and collection

<!-- measured: node tools/bench-angular-leaf-memory.mjs; raw samples in apps/demo/public/benchmarks/angular-native-memory.json -->

Five isolated processes per arm create 100,000 leaves, force heap quiescence,
then destroy and release the tree. The observed arm reads 10,000 leaves before
measurement.

| Arm                       |                     Universal |                        Native |   Native delta | After `destroy()`                       |
| ------------------------- | ----------------------------: | ----------------------------: | -------------: | --------------------------------------- |
| 100k unobserved leaves    | 184.462 MB / 1,934 B per leaf | 184.472 MB / 1,934 B per leaf |   0 B per leaf | Both trees and sampled leaves collected |
| 100k leaves, 10k observed | 191.207 MB / 2,005 B per leaf | 184.476 MB / 1,934 B per leaf | -71 B per leaf | Both trees and sampled leaves collected |

The selected implementation therefore adds no measurable unused-leaf density
slope. Native observation needs no second projection object because the leaf is
already the framework primitive.

## Historical native comparator

Reproduce with `node --expose-gc tools/bench-angular-leaf-strategies.mjs` using
the historical and production artifact roots recorded in the raw JSON.

The `851f496e` branch used native Angular leaves but gave framework code more
runtime ownership. The current design keeps kernel slots and causal semantics.
Compared with that branch, reads (3.293 ns versus 3.315 ns) and replacement
(41.843 ns versus 41.430 ns) are inconclusive. Current scalar derivation measured
6.5% slower with a +4.6% to +8.2% paired interval; fan-out measured 9.3% slower
at 10 dependents and 6.6% slower at 100. Construction is inconclusive at 10
leaves and slower at 100 and 1,000 leaves. The complete operation-level samples
and intervals remain in `angular-native-vs-historical.json`; these costs buy
kernel-owned equality, causal turns, transactions, restoration, and coherent
publication rather than a second framework state authority.

## Decision

The rejected lazy native-under-`Location` design retained callable Angular
leaves while allocating extra per-leaf machinery and adding another reactive
path. The final direct carrier removes that duplicate path:

- kernel slots remain canonical;
- Angular dependency tracking runs on the public native signal;
- `.set()` and `.update()` still enter kernel replacement and derivation paths;
- transactions, restoration, EntityMap identity, and coherent publication stay
  kernel-owned;
- React remains selector/hook-native rather than inventing a persistent carrier;
- Vue exposes native refs over the same kernel authority.

This is a carrier decision, not a second state authority.
