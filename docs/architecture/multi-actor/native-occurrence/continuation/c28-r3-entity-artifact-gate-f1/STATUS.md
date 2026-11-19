# F1 correction status

Candidate ready for concurrent review: `/private/tmp/st-c28-r3-entity-artifact-gate-f1/candidate`.

Base: preserved composed source manifest `42280bba7bc92b75ae3f252742de5b7f78e4cce0b61c1d935212d7e438f2baf1`. Original tooling identity `26193d775b3e3f9c0ecc859de029dc20a1a591638730846ac0413bc1e89b6c1e` is also preserved and was fully verified before preparation. `BASE-IDENTITIES.json` records both.

No blocker. Implementation and final identity/evidence packaging are complete. Main owns independent review/acceptance.

Only three existing tooling files changed relative to the composition: `tools/verify-entity-registration-artifacts.mjs`, `tools/verify-gates.mjs`, and `tools/experiments/entity-registration/README.md`. Peer fixtures, runtime, package files and shared source/artifact cases are unchanged.

The registry result contract is opt-in for this companion only. It requires exit 42 plus exactly one per-run-token-bound structured witness, identifying classifier blindness AFTER passing baseline, both mutant modes with behavioral assertions, setup/control success, clean recovery, and unchanged inputs. An invalid/missing witness is an error; this gate's parent is deferred until the companion witness validates. Generic unrelated mutation/provenBy behavior remains unchanged. TMPDIR inside a workspace is rejected before consumer creation. The README limits observed npm qualification to 11.12.1; no second version is claimed.

Completed checks (all receipts here):

- `registry-offline-negative.log`: full selected registry selftest, empty npm cache and offline setup => exit 1; **0/2 proven, 2 errored**, baseline-ci setup failure. Parent not proven.
- `registry-normal.log`: full selected normal registry => exit 0; **2/2 passed**, including normal clean baseline/behavioral mutant/recovery.
- `registry-blindness-positive.log`: full selected registry selftest => exit 0; **2/2 proven**, companion witness accepted at exit 42, parent proven only afterward. Mutation run includes both modes and clean recovery.
- `tmpdir-preflight.log`: in-workspace TMPDIR rejected before consumer creation.
- `FOCUSED-RESULTS.json`: tool restored hash and actual Node/npm versions.

No extra campaigns, source-spec reruns, alternate npm-version tests, or unrelated gate-semantic changes were performed for this correction.

Npm reconciliation update: current-root and candidate workflow hashes match. Official Node release metadata confirms Node 24.15.0 bundles npm 11.12.1. The publish workflow still uses `npm@^11.5.1`; current registry metadata's highest matching version is 11.21.1. A single exact-11.21.1 normal gate smoke is now running against the sealed current artifacts, using a temporary npm install and fresh consumer cache. No alternate-version mutation campaign or rebuild is being run. Receipts: `CI-NODE-RELEASE.json`, `NPM-WORKFLOW-INPUTS.json`, `publish-npm-range.json`, `npm-11.21.1-smoke-*`.

Final source manifest: `8f902607f4e4f9fa31bda66c0b1c87ce3fe38a6c2b7a145c366498a5fc9d5333`. Base remains 42280, with the same b4d66 diagnostic runtime. Exact npm 11.21.1 sealed normal gate smoke passed; see `REPORT.md`, `IDENTITY.json`, `NPM-QUALIFICATION.json`, `EVIDENCE-INDEX.json`, `F1-correction.patch`, and `full-tooling.patch`. Independent review remains with Main.
