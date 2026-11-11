# Automated application lab

Non-shipping Angular consumer fixtures for the
[registered protocol](../../docs/audits/2026-11-11-application-comparison/PROTOCOL.md).
The [execution record](../../docs/audits/2026-11-11-application-comparison/README.md)
contains the qualified baseline, complete comparisons, preserved first failures
and private application experiments. Published v15.4.8 registry artifacts were
verified before comparison. Runtime packages are unchanged by this lab.

The common interface names user actions and presentation reads. It does not
supply a shared rollback, publication or reconciliation implementation. Each
arm owns its state and application coordination. All arms receive the same
domain inputs, external decisions and visible viewport; additional internal
work is measured rather than artificially equalized.

Production library packages, public exports and frozen semantics are unchanged.
Source-only predictions about competitors are hypotheses until the registered
small probes execute against identified packages.

## Reproduce the application checks

Use the repository's Node version. Each destination below must be a fresh
absolute directory. Failed packets are immutable evidence; a correction gets a
new packet rather than replacing logs. The toolchain command installs exact
dependency versions and records the lockfile and package identities.

```sh
node tools/application-lab/lab.mjs toolchain /tmp/application-toolchain
node tools/application-lab/lab.mjs check-backend /tmp/backend-check /tmp/application-toolchain
node tools/application-lab/lab.mjs prepare /tmp/application-packet /path/to/verified-registry-directory /path/to/qualified-v16-checkout sha256-ba5c01b75cd74e50293262f2a324cfe4072353dc845211e5c95e19948b126e05 /tmp/application-toolchain
node tools/application-lab/lab.mjs build /tmp/application-packet
node tools/application-lab/lab.mjs build-dispatch /tmp/application-packet
node tools/application-lab/inventory-check.mjs /tmp/application-packet
node tools/application-lab/dispatch-check.mjs /tmp/application-packet
```

The verified registry directory contains all five publication receipts in
`verification.json`, their downloaded archives, and `closure.json` binding the
successful signature/runtime/type/AOT checks to their logs. Preparation checks the selected
release, verifies the archive digests, and recomputes the qualified v16 build seal.
Each arm gets its own actual SignalTree payload where applicable and the same
frozen framework/toolchain peers. Production AOT build statistics record the
dependencies actually included, rather than attributing every installed peer to
every arm. All input and served bytes are checked before and after execution.

Inventory and dispatch share rendering, domain inputs, test service and oracles.
They do not share an optimistic-state or publication coordinator. The production
fixtures include explicit `fault` controls used only by the conformance driver;
normal measurement never enables them. Their common fixture overhead is part of
the served-size measurement.

## Calibrate, then freeze and measure

```sh
node tools/application-lab/measure.mjs calibrate /tmp/application-packet /tmp/inventory-calibration
node tools/application-lab/dispatch-measure.mjs calibrate /tmp/application-packet /tmp/dispatch-calibration
```

Inspect calibration for failures, run length and measurement resolution before
selecting the comparison schedule. `compare` writes its schedule before any
browser launches, uses fresh serial Chromium processes and retains every result.
Conformance must match the exact current build. Changed fixture inputs require
rebuilding and requalifying a new packet.

Once calibration is reviewed, execute the registered serial cohort and analyze
only its complete results:

```sh
node tools/application-lab/measure.mjs compare /tmp/application-packet /tmp/inventory-comparison
node tools/application-lab/dispatch-measure.mjs compare /tmp/application-packet /tmp/dispatch-comparison
node tools/application-lab/analyze.mjs /tmp/application-packet /tmp/inventory-comparison /tmp/dispatch-comparison /tmp/comparison-summary
```

The analyzer checks schedule completeness, matching identities and raw receipts,
then reports independent-child distributions and matched v16/v15 ratios. Same-arm
controls remain separate; they are not confidence intervals. A zero denominator
produces an explicitly unavailable ratio.

Record the source maintenance surface from the actual packet copies:

```sh
node tools/application-lab/source-inventory.mjs /tmp/application-packet /tmp/source-inventory.json
```

This verifies each counted source against the packet and checks that common code
and the shared v15/v16 implementations match. Counts include comments, types and
imports; shared files are explicitly separated. They do not measure productivity.

Results distinguish startup, synthetic event-to-stable-layout latency, controlled
reply processing, per-process timing distributions, finite heap checkpoints and
raw/gzip JavaScript. These are not INP, calibrated-device measurements, backend
durability or measured developer productivity. See the protocol for the complete
limits, equal-work requirements and interpretation rules.

## Attribute a measured cost

After exact-build conformance passes, use a separate instrumented run:

```sh
node tools/application-lab/profile.mjs /tmp/application-packet v16 inventory /tmp/inventory-profile 1000
node tools/application-lab/profile.mjs /tmp/application-packet v16 dispatch /tmp/dispatch-profile 1000
```

These commands save raw Chromium profiles, source-map locations, sample coverage
and task/script/layout/style duration deltas using the explicit `timeTicks`
domain. Those durations overlap and must not be summed. Sample timestamp intervals
include idle, garbage collection and browser-protocol work; they are diagnostic
weights, not measured per-function CPU. A short action with no mapped samples
reports insufficient attribution. Check the actual source and use a matched
before/after consumer before attributing a latency improvement to a library.
Profiling results never enter the uninstrumented comparison cohort.

## Compare private application changes

The original packet and source remain frozen. `prepare-variant.mjs` copies their
verified inputs into a new packet, preserves actual installed dependency hashes,
and substitutes only named private arm files. Selection JSON uses absolute paths:

```json
{
  "replacements": [
    {
      "arm": "tanstack",
      "scenario": "inventory",
      "source": "/checkout/tools/application-lab/arms/tanstack-inventory-stable-view.ts"
    },
    {
      "arm": "tanstack",
      "scenario": "dispatch",
      "source": "/checkout/tools/application-lab/arms/tanstack-dispatch-detached-payload.ts"
    }
  ]
}
```

```sh
node tools/application-lab/prepare-variant.mjs /tmp/application-packet /tmp/application-variant /tmp/selection.json
node tools/application-lab/lab.mjs build /tmp/application-variant
node tools/application-lab/lab.mjs build-dispatch /tmp/application-variant
node tools/application-lab/inventory-check.mjs /tmp/application-variant
node tools/application-lab/dispatch-check.mjs /tmp/application-variant
node tools/application-lab/publication-payload-check.mjs /tmp/application-packet /tmp/application-variant /tmp/payload-check
node tools/application-lab/measure-variants.mjs /tmp/application-packet /tmp/application-variant /tmp/paired-inventory
node tools/application-lab/analyze-variants.mjs /tmp/application-packet /tmp/application-variant /tmp/paired-inventory /tmp/paired-inventory-summary
node tools/application-lab/dispatch-measure-variants.mjs /tmp/application-packet /tmp/application-variant /tmp/paired-dispatch
node tools/application-lab/analyze-variants.mjs /tmp/application-packet /tmp/application-variant /tmp/paired-dispatch /tmp/paired-dispatch-summary dispatch
```

The [improvement protocol](../../docs/audits/2026-11-11-application-comparison/IMPROVEMENTS.md)
adds a title edit that changes filter membership. Both before/after applications
execute it; its heap results are kept separate from the original cohort.
Dispatch preserves the original child workflow exactly, including separate
timing and memory processes. Its original memory workload has no started plans,
so it cannot establish payload-retention savings. The supplemental public-payload
checker verifies exposure and detachment; its planted fault must be detected.

The separate [lifecycle diagnostic](../../docs/audits/2026-11-11-application-comparison/LIFECYCLE-FOLLOWUP.md)
extends inventory aging and actually populates publication storage. It uses three
fresh browser pairs per row count, reports whole-application heap and weak-reference
observations, and saves a final heap snapshot when sampled objects survive teardown.
It has no comparative timing claim or fitted memory ceiling.

```sh
node tools/application-lab/lifecycle-followup.mjs /tmp/application-packet /tmp/application-variant /tmp/inventory-aging inventory-aging
node tools/application-lab/lifecycle-followup.mjs /tmp/application-packet /tmp/application-variant /tmp/publication-lifetime publication-payloads /tmp/payload-check
python3 tools/application-lab/analyze-lifecycle.py /tmp/inventory-aging /tmp/publication-lifetime /tmp/lifecycle-summary
node tools/application-lab/started-payload-teardown.mjs /tmp/application-packet /tmp/application-variant /tmp/started-teardown /tmp/publication-lifetime
```

The neutral installed-package diagnostic that rejected the `addMany` substitution
can also be repeated independently:

```sh
node tools/application-lab/population-probe.mjs compare /tmp/application-packet /tmp/population-diagnostic
```

## Preserve and verify evidence

`archive-evidence.py` stores selected files and their declared hash references as
content-addressed payloads, with original path/version mappings and a standalone
verifier. Historical recovery accepts only bytes matching the recorded hash.
Select raw logs and profiles explicitly; it does not crawl dependency directories
or source-map URLs. A selection file contains `{"files":[{"path":"/absolute/file"}]}`.

```sh
python3 tools/application-lab/archive-evidence.py create /tmp/study-evidence --selection /tmp/evidence-selection.json --recover /tmp/old-source-snapshot
python3 tools/application-lab/archive-evidence.py verify /tmp/study-evidence
python3 tools/application-lab/archive-evidence.py pack /tmp/study-evidence /tmp/study-evidence.tar.gz
python3 tools/application-lab/archive-evidence.py extract /tmp/study-evidence.tar.gz /tmp/extracted-evidence
python3 /tmp/extracted-evidence/archive-evidence.py verify /tmp/extracted-evidence
```

This verifies included integrity and reference closure, not signed authenticity,
repository-history completeness or availability of every dependency needed for a
fresh rebuild. Self-tests exercise missing/tampered payload rejection, unsafe
paths and original-free verification; failed attempts remain evidence.
Compressed verification uses temporary disk space for one uncompressed tar so
reference checks can seek without repeatedly decompressing the gzip stream.
