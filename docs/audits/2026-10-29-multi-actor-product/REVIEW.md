# Independent review and validation

October 29, 2026. Research only; no runtime implementation or acceptance.

## Review questions

Two independent reviewers received the draft README, source ledger and proposed acceptance scenarios. Preferred conclusions and the other reviewer's verdict were withheld during their evidence-gathering tasks.

- **Premise/alternatives:** compare existing stacks fairly; identify product-scope expansion, a second state authority, and implementation-shaped test oracles.
- **Local interpretation:** compare the recommendation with the active readiness source; identify overclaimed APIs, approval/confirmation confusion, external-ingress errors and public/private tooling ownership errors.

The local reviewer described the recommendation as coherent as a non-authorized product direction, with corrections. The alternatives reviewer supplied five substantive corrections rather than implementation acceptance. Neither review qualifies runtime, market demand for this exact product, or release readiness.

## Corrections incorporated

| Finding | Disposition |
| --- | --- |
| Alternative architectures must not implement SignalTree-shaped APIs to pass | Common product outcomes separated from SignalTree conformance |
| Strong existing stack was only optional | TanStack DB + versioned backend + immutable proposals is required C3 for the dispatch fixture |
| TanStack capability comparison understated existing integrations | Added conflicting rollback, Electric acknowledgment and offline retry sources and limits |
| Companion could become a second authority | Explicit prohibition; approval consumption must validate and act at the authoritative boundary, otherwise record a missing seam |
| Parallel prototype language could silently expand v16 | Prototype and full-product qualification explicitly future selectable work, not automatic release dependencies |
| Product thesis could not lose fairly | Added existing-stack-win disposition; application glue counts for every arm |
| Link completion could be mistaken for persistence | Explicitly recorded that `settled()` can resolve after endpoint failure |
| Remote source classification too coarse | M12 distinguishes authored remote computation from authoritative synchronous realization |
| Existing tooling was understated | Added versioned lifecycle/context and Link observations with limits |
| Acceptance requirements mixed established and proposed scope | Separated integration portions and authority sources; scenarios do not authorize implementation |
| Production-route document misrepresented as authority | Relabeled planning recommendation |
| XState documentation version could be misleading | Recorded v6 alpha banner and need to pin executed comparator version |

## Evidence limits

No runtime tests, external package benchmark, customer interview or adoption experiment was performed. Historical outcomes remain attributed to the identified records. These are architectural recommendations and unexecuted qualification scenarios, not a newly proved algorithm.

The external source ledger is representative, not exhaustive. A broad need for accountability does not prove superiority of this proposed library packaging.

## Local validation

Validation uses Python standard-library Markdown target extraction over the four files in this directory. Relative file links must resolve; external links are excluded from that local check and were researched separately. Git whitespace checking covers each new file against `/dev/null`. The final command output is reported to the user; no release-wide documentation or build gate is claimed.

Root checkout remains `628d302d`; unrelated untracked `frontier` is untouched. Active readiness runtime, rejected candidates, controller, existing policy edits and B closure are unchanged. This record does not authorize activation, API exports, packaging, ceilings or publication.
