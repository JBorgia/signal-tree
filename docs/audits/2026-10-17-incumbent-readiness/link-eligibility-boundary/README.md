# Link eligibility and separate destruction boundary

Baseline `7c511c2b59e803b065b2a674e0f7b0a897f85145`; production runtime unchanged
at `87f6831fa60cafe87508f0ace84b7638698ca3b0`. No runtime/API/policy changes,
new overrides, budgets, B work or release acceptance. The reviewed delivery
mechanism is reused unchanged, not credited with discovering eligibility.

## Finding

A complete immutable possible-owner set can discharge when all its owners confirm.
Keeping it held after that would be missing resolution bookkeeping. The private
experiment instead stores only clean/unknown and has no owner/outcome resolution
path. Its permanent unknown in the simple all-confirm control is an experimental
limitation, not evidence that safe confirmation-based release is impossible.

The runtime supplies owner identities and outcomes. It does not supply proof that
those owners exhaust the inputs consumed by an ordinary write. Zero current pending
owners is not that proof. The unsupported boundary is **unannotated ordinary
JavaScript value flow outside a complete tracked input domain**, including synchronous
retained locals—not only asynchronous callbacks.

## Minimal observed controls

| Sequence | Unchanged current Link | Reviewed experimental delivery/eligibility |
| --- | --- | --- |
| One pending owner, direct write, confirm | sends7 after confirm | stays unknown/held |
| Same, synchronous reactive copy | sends7 after confirm | stays unknown/held |
| p and q pending, y copies q; confirm p | holds while q pending | holds |
| Then confirm q | sends9 | stays unknown/held |
| Instead reject q | sends surviving9 | stays unknown/held |
| Later ordinary literal/captured overwrite | same observed write facts | neither supplies a new clean proof |
| p read7, reject p, then literal7 versus retained local7 | sends7 in both arms | holds both |
| Authoritative inbound42 while unrelated owner pending | holds until settle | sends42 while owner pending |

The paired post-rejection case executes the same read and rollback in both arms:

```ts
const p = tree.transact(() => tree.$.x(7));
const captured = tree.$.x();
p.rollback();
tree.$.y(7);        // arm 1: independent literal
// versus tree.$.y(captured); // arm 2: retained rejected value
```

Both y writes have previous0, value7, no pending scope and the same normalized
metadata: mutationIntent replace and tree identity. The application-local expression
is not represented. No promise, timer or async boundary is used. Equal overwrites
likewise cannot supply an evidence-completeness certificate through value comparison.

This is not a universal impossibility theorem. It falsifies sufficiency of the
observed write/lifecycle facts for this desired distinction. A claimed complete
input boundary must be real and specified; a harness cannot manufacture it.

## Evidence lifecycle and timing

[Source audit](SOURCE.md) traces creation/open before writes, write notification,
confirmation/rejection, pending-view removal and consequence release. Mutation
metadata identifies authored transaction attribution, not all consumed dependencies.
Lifecycle readers expose current pending identities and future transitions, not
retrospective terminal history. A snapshot can miss earlier rejected inputs.

Confirmation records its outcome before releasing consequences, but public lifecycle
reader delivery follows consequence execution. A naïve listener would update too
late. Direct source attachment occupies a single observer slot and would displace
existing tooling. Refusal, abandonment and destruction are not confirmation.
No lifecycle interception was added to overcome these boundaries.

The prior immutable model already demonstrates all-confirm resolution for supplied
complete sets. This investigation does not repeat it or pass its assumptions off as
runtime capture. The missing fact is completeness, not the ability to compare outcomes.

## Existing contract versus stronger desired safety

Current commit-consequence source explicitly publishes **current surviving truth**
after all scopes settle, by confirmation or rejection. An ordinary y write is not
rolled back merely because it consumed x. Notifications do not promise causality or
complete history. Baseline publication of surviving y after rejection is therefore
not a newly proven capture defect. It is a negative result against the stronger
requested causal-publication criterion. That criterion remains a valid experiment
requirement; its product boundary needs explicit wording before changing behavior.

## Destruction disposition

[Separate lifetime report](DESTRUCTION.md) and unchanged source tests establish:

- A previously queued value may send after tree.destroy(); the tests intentionally
  allow either no send or that one value. The old research assertion demanding zero
  sends was stronger than the established contract; its original result is preserved.
- An already-started request may complete. A tree-destruction waiter resolves on its
  acknowledgement in the tested case.
- Held work stays unsent, but its waiter remains pending until explicit Link.dispose().
  This is a reproduced, previously documented lifecycle gap, not a new eligibility bug.
- Explicit connection disposal prevents unstarted calls and releases local waiters,
  including before an already-started request completes. It does not retract I/O.

Tree destruction and independently owned connection disposal are not equivalent.
No automatic disposal or lifetime migration was implemented.

## Review, verification and disposition

[Independent review](REVIEW.md) replayed both saved eligibility bundles: all22 trace
entries per arm exactly match. Each receipt verifies88 source inputs; the baseline
has zero transformed sources. Twenty eligibility checks assert observations, not
acceptance. Six destruction controls run in both arms with42 observation checks;
root replay verifies both saved bundles and the governing tests/history.

[Raw archive](evidence.tar.gz) preserves sources, bundles, hashes, logs and reviews;
[identities](SHA256SUMS) pin the record. No kernel/framework suite, performance campaign,
package build or release verification ran. These are finite scalar microtask probes,
not general liveness, native-framework, entity or retention qualification.

Keep production unchanged and automatic independent progress release-blocking.
There is no justified additional delivery repair or override from this result.

## Owner decision — October 19, 2026

The owner selected **“Preserve surviving-write semantics.”** In the reproduced case,
an application reads x=7 while a transaction is pending, rejects that transaction,
then ordinarily writes the retained 7 into y. That write authors new surviving
application truth; it does not inherit the rejected causal origin. Once scopes
settle, current Link publication of that surviving write is accepted behavior.

This resolves the post-rejection local-copy premise only. It does not declare
ordinary writes independent while other transactions remain pending, clear their
unknown evidence, approve an API, or qualify the experimental delivery mechanism.
Automatic independent progress remains required and release-blocking. Production
hold, separate destruction obligations and artifact blockers remain unchanged.

The original research assertions, raw archive and independent review predate this
owner disposition and remain unchanged. Their stronger historical-causality oracle
is not an acceptance requirement for this approved case; its observed result is
preserved rather than rewritten as an implementation failure or a new passing test.

## Replay

```sh
mkdir -p /private/tmp/link-eligibility-replay
tar -xzf evidence.tar.gz -C /private/tmp/link-eligibility-replay
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
cd /private/tmp/link-eligibility-replay/eligibility
node check.mjs
node --input-type=module -e 'const {run}=await import("./baseline-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > baseline-replayed.json
node --input-type=module -e 'const {run}=await import("./bundle.mjs"); console.log(JSON.stringify(await run(),null,2))' > research-replayed.json
cd ../destruction
shasum -a 256 -c SHA256SUMS
node check.mjs
```

Loader rebuild commands use the saved absolute /private/tmp directories and exact
checkout recorded in each loader. Bundle replay needs neither source edits nor a
new build. Trace checks intentionally classify surviving holds and known gaps;
they must not be summarized as product acceptance.
