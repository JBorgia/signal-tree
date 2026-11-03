# Immutable owner-window eligibility: bounded candidate rejected

Source baseline `3a20d56c7b4dce75bf9b4a50f43f0386cfd75b06`; production runtime
remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`. No production policy, API,
budget or architecture activation changed. B stays closed.

The experiment demonstrates useful automatic progress in a restricted case, but
fails its unchanged ABA acceptance control. Do not integrate this revision or
claim the overall independent-progress requirement satisfied.

## Mechanism and scope

[Prewritten specification](SPEC.md) and [independent premise review](PREMISE.md)
define an immutable revision ticket containing every owner pending on the same tree
at an actual authored write. Those owners must all confirm. A later owner does not
retroactively block an unchanged earlier revision. Rejected, refused or missing
outcomes are never converted to confirmation by disappearance.

The loader observes actual lifecycle state before reentrant listeners, snapshots
at mutation notification before coalescing, records irreversible terminal outcomes,
and queues eligibility-change wakes after the settlement turn. A wake rechecks the
current ticket, then enters existing Link dirty/flush/held/chain machinery. It does
not replay a previously resolved send promise or replace public lifecycle observers.
The previously reviewed delivery algorithm and its final revision check are retained.

Approved surviving-write semantics allow a new actual ordinary write after rejection
to get fresh evidence; any remaining pending owners still enter that new window.
Old revisions are not restamped as fresh. Realization/restoration/inspection and
foreign transaction attribution remain conservatively ineligible. Incoming Link
acquisition retains its separately tested authoritative-input boundary.

## Results and decisive counterexample

| Control | Observed result |
| --- | --- |
| p pending; direct y42; q opens later; p confirms | sends42 while q remains pending |
| Same with synchronous copy from p | copied8 progresses while q remains pending |
| Both p,q pending before write | holds after p confirms; releases after q confirms |
| Captured p rejects | old ticket holds; later actual write captures remaining q and releases after q confirms |
| New overwrite, opened-listener write, sending-observer reentry | tested current-revision cases pass |
| Failed rollback/refusal | stays held until later confirmation |
| Realization and foreign attribution | remain held |
| ABA42→99→42 while p,q pending | **fails: no send after both owners confirm** |
| Pending input copied from another tree | sends7; **unsupported safety boundary**, not independent work |

The ABA sequence is ordinary input:

```ts
const p = tree.transact(() => tree.$.x(7));
tree.$.y(42); // delivered to Link with ticket21, blockers[p]
// drain the notification turn
const q = tree.transact(() => tree.$.z(9));
tree.$.y(99);
tree.$.y(42); // same batch: latest ticket24, blockers[p,q]
p.confirm(); // correctly remains held
q.confirm(); // expected42; actual no delivery
```

Exact executable source, including drains, is in the archive's implementation/window.ts.
At mutation time the latest index advances through tickets23 and24. The notifier
intentionally skips a net-equal42→99→42 publication at path-notifier.ts502–510.
Link therefore retains ticket21. Every wake requires current-ticket identity and
rejects ticket21 against latest24, even though both terminal outcomes were recorded.
This is a responsibility-evidence transport failure across deliberate value-level
coalescing, not absent confirmation information. Reusing ticket21 or comparing only
values would discard newer responsibility; disabling memoization was not attempted.
No repair was made after this first executed mechanism failure.

## Preservation, review and limits

[Worker results](RESULT.md) and [independent implementation review](REVIEW.md)
record 45 passing assertions and1 ABA failure across11 asserted scenarios. The
cross-tree case is separate. Root and reviewer independently replayed the frozen
bundle; reviewer matched the full saved JSON exactly. Existing lifecycle observation
continued to receive opened/confirmed facts.

The historical delivery fixture remains byte-for-byte unchanged:32 checks pass;
2 old unknown-after-confirmation assertions now fail because the proposed eligibility
behavior intentionally sends42 and resolves its wait. Those are retained oracle
conflicts, not two newly broken delivery transitions and not34 passing checks.
The earlier witness retains its known tree-destruction research assertion and
post-destroy confirmation harness error. Prior destruction adjudication still
applies: queued delivery after destroy is permitted by existing tests; held-waiter
cleanup remains a separate known gap.

First build failure was an invalid test import, corrected to the existing internal
write-context module. Its source/log remains preserved; no test executed in that
attempt. No private algorithm or assertion changed after the first executed window
failure. Strict standalone helper TypeScript passes; transformed kernel execution
through esbuild is not full typecheck or production integration qualification.

All source inputs match the baseline:91 in the window bundle,88 in each historical
bundle. Exactly Link, PathNotifier and transactions are transformed in memory. No
repository runtime source changes occurred. Retained module maps still contain
sources/outcomes/revisions after teardown; only wake subscriptions are removed.
There is no reclamation, memory, runtime-cost, entity or framework qualification.
Capture failure invalidates prior eligibility in source, but staged fault injection
was not run; no universal allocation recovery claim follows.

The successful case concerns owners opened **after** authorship. A direct unrelated
write made while another owner is already pending still conservatively waits for
that owner. Cross-tree copies lack the needed bound and can publish speculation.
This is evidence for a narrow capability, not a general automatic-progress policy.

## Disposition

Reject this candidate as an integration. Preserve the approved surviving-write rule
and the reviewed delivery controls. Production hold and the independent-progress
release blocker remain unchanged, as do separate artifact blockers. The concrete
new requirement is coherent transport of responsibility revisions across net-equal
value batches; this record does not select another transport or expand scope.
No value-equality exception, new override, global provenance graph, API or release
change is authorized by these results.

## Replay

[Evidence archive](evidence.tar.gz) and [SHA256SUMS](SHA256SUMS) preserve exact
sources, first failures, bundles, receipts and root replays.

```sh
mkdir -p /private/tmp/link-owner-window-replay
tar -xzf evidence.tar.gz -C /private/tmp/link-owner-window-replay
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
cd /private/tmp/link-owner-window-replay/implementation
shasum -a 256 -c SHA256SUMS
node --input-type=module -e 'const {run}=await import("./first-window-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > ../window-replayed.json
node --input-type=module -e 'const {run}=await import("./targeted-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > ../delivery-replayed.json
```

Inspect each check's pass field: a zero bundle exit does not erase the recorded ABA
failure. Loader rebuild commands and original absolute paths are in RESULT.md.
No broad suites, benchmarks or release verification ran for this research-only record.
