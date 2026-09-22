# CPU — final disposition

**`CPU UNKNOWN — V3 STOPPING RULE TRIGGERED`.** Dated 2026-09-21. This closes
the CPU question for the entity-realization decision. No v4.

## What happened

The preregistered v3 gate required four entity workloads at or under 5% A/A in
each of three token-vs-token preflights. Preflight 1, on a calm host:

```
updateOne          3.4% A/A   PASS
byId-warm         20.0%       FAIL
byId-cold         24.8%       FAIL
field-read-held   21.8%       FAIL
```

The gate failed, so the four-way candidate run was correctly NOT executed.

Conditions were genuinely calm. The runner blocked until load < 3.0 and > 3 GB
free, and the settle line immediately before the harness reads
`calm: load 2.63, 20.2 GB free` on a 32 GB machine. (`preflight-1-machine.txt`
in the evidence folder records load 4.45 because the runner writes that snapshot
BEFORE the settle wait — a defect in the runner's ordering, not in the
conditions. The settle line is authoritative.)

This reproduces. Across three independent runs on calm hosts, `byId-warm`
measured 8.5%, 11.5% and 20.0% A/A — never close to 5%. `updateOne` passed every
time. The failure is a stable property of this workload on this hardware, not
bad luck.

## What is NOT concluded

**It is not established that Angular-native has no CPU cost.** It is not
established that it has one. Every candidate delta measured in this program
failed its A/A gate and is inadmissible, including the ones that favoured the
native carrier.

The accurate statement:

> CPU differences could not be resolved on the available hardware under the
> preregistered methodology. Among implementations with validated semantics,
> Angular-native provides the lowest measured Angular memory cost, saving
> 513 B/entity (27.5%) versus the normalized token realization.

## The decision, on the evidence that did resolve

| candidate          | Angular released | semantics |
| ------------------ | ---------------: | --------- |
| strong             |          2,222 B | valid, control only |
| cell               |          1,991 B | valid, REMOVED from the frontier |
| token              |          1,863 B | valid |
| **Angular-native** |      **1,350 B** | **valid — chosen for Angular** |

```
@signal-tree/kernel     semantic authority, shared epoch publication,
                        portable token fallback
@signal-tree/angular    Angular-native epoch realization
@signal-tree/vue        token epoch            1,576 B/entity
@signal-tree/react      token / neutral path   ~1,748 B/entity
```

The **cell epoch leaves the frontier**: memory-worse than token on both Angular
(1,991 vs 1,863) and Vue (1,656 vs 1,576), with identical intended semantics and
no admissible CPU evidence of a compensating advantage.

The **strong carrier remains documented as a historical control**, not the
preferred Angular path.

## Evidence

Raw output preserved at `~/signaltree-cpu-results/results/` and, for the
decisive preflight, in `cpu-v3-evidence/` beside this file.

No further performance methodology work is justified for this decision.


---

## LANDED

The framework-specialized epoch architecture is production code on the research
branch. The six production files were replayed from `cpu/v2-angular-native`
(`86476116`) onto HEAD rather than merged: no production file had changed on
HEAD since the candidates branched, so the replay is exact and every later doc
and fix is intact.

| marker                 | status |
| ---------------------- | ------ |
| Angular-native epoch   | **CHOSEN** |
| portable token fallback| **CHOSEN** for Vue / neutral / React |
| shared publisher       | **CHOSEN** common infrastructure |
| cell epoch             | **REJECTED** — dominated on memory |
| strong carrier         | **HISTORICAL CONTROL** |
| CPU                    | **UNKNOWN / CLOSED** |

Validation from a clean `dist`: build OK across kernel/angular/vue/react;
kernel 280 files / 2,350 tests; angular 24 / 151; vue 4 / 33; lint clean.
Guards: `native-epoch-publication` 3/3, `native-projection-observability` 1/1,
`subject-epoch-non-retaining` 12/12, `subject-state-weak-realization` 10/10.

Kernel neutrality: zero framework imports in `packages/kernel/src` production
code.

Memory regression check, two runs, released B/entity — all as expected:

| row     | measured | expected |
| ------- | -------: | -------: |
| angular |    1,350 |    1,350 |
| vue     |    1,576 |    1,576 |
| kernel  |    1,747 |    1,747 |
| react   |    1,748 |    1,748 |

The candidate branches and experimental documentation are deliberately
preserved as evidence. Cleanup, if wanted, is a separate mechanical pass.
