# Startup and economic evaluation

The [study protocol](../../docs/audits/2026-11-18-startup-market-economics/PROTOCOL.md)
defines the comparison. These tools preserve earlier experiments; they do not
replace the canonical runtime gates or authorize publication.

| Entry point | Input and responsibility |
| --- | --- |
| `economics.py` | Explicit scenario/source inputs; customer, supplier and joint resource arithmetic. No measured demand or forecast. |
| `economics-controls.py` | Independent arithmetic and adverse-input checks. |
| `qualify-artifacts.py` | Exact committed source and line-specific builder; fresh packages, canonical prepare-only archives, installed consumers and production demo. Full normal/mutation registries run separately first. |
| `run-application.py plan` | Configuration naming frozen current packages and qualified successor manifests; creates an immutable execution plan. |
| `run-application.py run` | Prepared plan and phase name or `all`; builds and checks eight production apps, then runs 288 separate timing/heap children across three row counts. |
| `admission.py` | Read-only canonical archive/source joins and completed application plan, phase-receipt, sealed-output and selected-identity joins. |
| `admission-controls.py` | Real v15 canonical admission plus synthetic completion/rejection controls. Synthetic fixtures are never performance data. |
| `application-cost.py` | Completed application and explicit account assumptions; complete-app cost tables and hypothetical capacity/transfer/delay envelopes. |
| `application-cost-controls.py` | Reject missing pairs, wrong units, incomplete samples and invalid tier inputs before producing delay scenarios. |
| `run-native.py` | Completed application packet; unchanged native v16 workflow, functional, CPU, heap and fault-control cohorts. |
| `assemble-evidence.py` | Hash-checked archive parts and a new directory; reconstructs the unchanged archive/index for the existing payload verifier. |
| `assemble-evidence-controls.py` | Actual copied parts outside the repository; verifies assembly/payloads and rejects four part/index faults. |
| `run-oversight.py` | Qualified canonical packages; installed public contracts and durable-authority Angular application. |

Each command's module header documents its positional arguments. Output paths
must be new. Preserve failed attempts rather than rerunning over them. Heavy
build/test/measurement work uses the study's single coordinated slot. Node and
package toolchain versions remain pinned in the input evidence.

Application output receipts seal their expected files when a phase succeeds;
downstream consumers verify those files and the exact local comparison, not
only a `passed` label. Model reporting requires complete requested comparisons.
Whole-app heap is not isolated library memory, browser elapsed time is not CPU
time, and numerical gate failures remain failed after a separately documented
cost disposition.

The public evidence archive contains selected source, packages, commands and
raw outputs. It verifies supplied payload integrity. Excluded dependencies,
browser binaries and repository history mean that this is not a claim that
every command can be rerun offline on an arbitrary machine.
