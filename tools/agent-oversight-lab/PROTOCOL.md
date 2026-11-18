# Oversight hypothesis evaluation — November 17, 2026

The owner asks whether v15's conveniences earn their cost, and whether v16 can
serve an emerging need for oversight, transparency, monitoring and functional
control when agents work alongside users. Test that need now; deployment
adoption is not a prerequisite. This is an investigation, not a new public SDK,
release gate, model benchmark or production security certification.

## Preregistered observable requirements

1. Keep proposals, declared actors, approval, remote receipts and native
   settlement distinct. Agent-supplied claims never mint reviewer authority.
2. Bound approvals to exact commands. Crossed grants, revocation and queued
   cancellation must prevent unapproved effects; an already applied effect must
   remain uncertain until recovered, never become a fictitious cancellation.
3. Permit concurrent independently reviewed work. Correlate out-of-order
   receipts to their original commands and native owners, preserve human work,
   and do not resend a terminal command to retry local settlement.
4. Supply useful monitoring facts without allowing a throwing observer to
   change settlement. Detect sequence gaps and history truncation; a current
   snapshot must not be presented as a replay of missing history.
5. After unsafe rollback refusal, report pending authority and whether
   consequences were released. Test this same question on v15 and v16 rather
   than treating their semantics as equivalent.
6. Characterize the boundary of reconstruction after an effect/receipt loss.
   The in-memory fixture is expected to lack durable deduplication; demonstrate
   that limitation explicitly, not as a library failure or a successful recovery.

## Execution and classification

`prepare.mjs IDENTIFIED_BUILD_DIRECTORY NEW_PACKET` verifies package inventories
against the recorded successful build, packs kernel and Angular without install
scripts, and emits a hash-bound configuration. It does not claim a new build.
`run.mjs CONFIG NEW_OUTPUT` runs the existing installed public workflow and
strict AOT/browser/HTTP reference, then the new Node oversight cases. A new
output directory preserves every first failure. `run.mjs CONFIG NEW_OUTPUT LINE
--common-only` runs just the common installed Node probes on release line 15 or
16; the existing browser runner can be invoked separately to avoid repeating
unchanged checks. All work stays loopback/local;
no model receives live credentials or access to external mutation targets.

Common Node oversight cases run against both identified v15 and v16 packages.
The existing native v16 workflow/browser suites run only on v16. API spelling
(`transaction` versus `transact`) is adapted, not semantics. V15's documented
release-on-refusal is characterized explicitly and does not pass the stronger
v16 containment requirement. The suites include malformed/crossed input and
fault controls; passing limitation witnesses do not count as fulfilled features.

Metrics: individual requirement verdicts; attempted and actual remote effects;
command/native-owner identity; outstanding ownership; event sequences, missing
events and explicit history truncation; preserved human state; cleanup outcome.
Counts are functional observations, not reliability probabilities. No latency,
heap, incident prevalence, developer productivity or human comprehension claim
is derived from these tests. Existing v15 cost evidence is identified separately.

## Ownership and remaining evaluation surface

Kernel: truthful local identity, transitions, refusal, publication and lifecycle.
Application/reference: proposal/review/command correlation and recovery policy.
Host/backend: authenticated principal, scope, destination, permission enforcement,
durable command/effect receipts and side-effect containment.
Private Studio/application tooling: recording, redaction, session correlation,
gap-aware presentation and investigator usability. These tests do not move
Studio source or durable recording into the public library.

Parallel remote browser approvals, actual process/browser restart, production
authentication/tenant isolation, redaction, navigation and cross-tab recovery,
observer backpressure, and human investigation tasks remain distinct requirements
unless an explicit new test establishes them. Deterministic hostile commands
test the execution boundary; they do not measure prompt-injection susceptibility
or real-model decision quality.
