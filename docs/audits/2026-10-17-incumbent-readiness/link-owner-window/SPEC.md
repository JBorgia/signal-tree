# One bounded eligibility experiment: immutable owner window

Baseline 3a20d56c7b4dce75bf9b4a50f43f0386cfd75b06. Private source-loader only;
production hold, public API, budgets and B closure unchanged. Reuse reviewed delivery
algorithm and first failures. No new override or ownership declaration.

Hypothesis: snapshot all currently pending owners on the SAME tree for each actual
ordinary authored revision. Do not label that write independent of any current owner.
Each immutable ticket has revision identity and immutable blocker identities. A
later transaction does not retroactively contaminate an unchanged earlier revision.
When all captured owners confirm, that revision can progress even while a later
unrelated owner remains pending. A rejected/missing/abandoned blocker never becomes
confirmed by disappearing. New writes get new snapshots; equal/no-op writes are not
invented as new evidence. Existing authoritative inbound acquisition remains a
separate known-clean boundary.

Owner decision 3a20d56c: ordinary post-rejection retained-local writes author new
surviving truth, without inherited rejected origin. This permits a fresh ordinary
write after terminal rejection, but does NOT permit wiping blockers off an unchanged
revision, or declaring a write independent of other owners still open. No promise
of arbitrary cross-tree or out-of-runtime causal tracking is made. Test cross-tree
copy as an explicit scope-limit witness if this mechanism would admit it.

Source instrumentation must observe opened state before reentrant listeners and
terminal confirmed/rejected transitions at their real authority point, without
replacing public lifecycle observers. Snapshot before publication. Refusal remains
pending. Abandonment/destruction cannot resolve as confirmation. Compensation,
restoration and inspection are NOT ordinary fresh-authoring operations: preserve
conservative hold unless their precise evidence already exists. Do not infer from
bare pending count or from value equality. Explicit transaction attribution to a
noncurrent/rejected owner cannot be ignored.

Fixed controls before implementation:
1. p open -> ordinary y -> q opens later on unrelated z -> p confirms: y progresses
   while q remains pending. Same with synchronous reactive copy from p into y.
2. p and q already open -> ordinary y: p confirms holds; q confirms releases.
3. Any captured owner rejects: original revision remains held. New ordinary write
   after terminal rejection gets a fresh window, but captures any still-pending q.
4. Later overwrite replaces snapshot, not append/union forever; ABA values do not
   erase the newer write's owner window.
5. Reentry opens q and overwrites y after eligibility: post-observer delivery check
   prevents obsolete publication; all delivery controls remain meaningful.
6. Opened-listener writes capture the newly opened owner; refusal does not release.
7. Authoritative ingress remains useful; prior callback leakage controls unchanged.
8. Revision facts immutable; owner terminal outcomes irreversible; no public reader
   overwritten by instrumentation.
9. Destruction behavior remains separately classified, no new teardown claim.
10. Cross-tree pending copy is not silently counted as proven independent. Report
    boundary explicitly; do not expand to a global provenance graph to pass.

Stop on a new mechanism-level counterexample. Preserve old expected unknown holds:
where all-confirm progress intentionally changes under this hypothesis, report old
oracle result and separate new expected assertion; do not silently edit prior tests.
Passing same-tree controls supports only this window-based progress, not independence
for simultaneous owners or comprehensive evidence capture. No broader qualification.
