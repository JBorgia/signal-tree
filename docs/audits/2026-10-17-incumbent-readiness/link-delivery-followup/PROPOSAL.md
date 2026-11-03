# One bounded delivery-state follow-up — PREIMPLEMENTATION

Scope: private disposable source-loader research against the same baseline and previous `/private/tmp/link-policy-bridge` artifacts. Preserve that directory byte-for-byte. No repository, public API, exports, transaction semantics, eligibility inference, or release changes. This proposal addresses scheduling/delivery only. Independent premise review and root go-ahead precede implementation. One implementation revision; preserve first failures, stop rather than repeatedly repair.

## Evidence and separation

Previous actual Link bridge proved authoritative ingress sends42 then7 while unrelated x7 remains pending. It failed when an admitted42 was invalidated by a sending observer, and when an unknown revision held an in-flight reconciliation continuation that blocked later eligible9.

Eligibility remains unchanged: a scalar revision stamped by actual authoritative acquisition can be eligible; ordinary direct/captured writes remain unknown. A constant42 held after unrelated confirmation is an ELIGIBILITY limitation, not a missing wake: confirmation supplies no evidence and must not release unknown. Scheduling repair must not clear unknown, infer causality, or delegate unknown to incumbent settlement.

## States and authority

Each connection retains its existing actual Link eligible projection and endpoint knownY. Research augments delivery with a revision-bound ticket and one drain continuation; it must not maintain a competing payload projection.

- **held**: latest candidate lacks eligibility; no endpoint invocation. It is retained as latest candidate, but it must not retain an unresolved promise that serially blocks a later replacement.
- **eligible**: latest candidate's exact revision is eligible and current; drain may attempt it. Eligibility is queried from current authority immediately before invocation.
- **inflight**: exactly one request has started with immutable captured payload and revision. Completion acknowledges only those bytes. A newer candidate is retained separately.
- **superseded**: a queued/held candidate replaced by a newer revision on this connection. It may no longer invoke endpoint.set. A started request is not recalled or relabeled; it remains inflight until completion.
- **disposed**: connection terminal, queued/held work cancelled, no new invocation, no wake callbacks retained. Completion of already-started I/O may settle waiters but cannot start work. Tree lifetime invalidation is a separate authority requirement; lack of an existing reliable source must be reported rather than inferred.

Transitions: mutation delivery replaces latest candidate; held→eligible occurs only on new evidence/revision, never mere tree confirmation. eligible→inflight occurs only after final revision/lifetime revalidation. inflight+replacement retains latest while current request continues. Completion updates knownY for actual completed bytes, then reconciles latest candidate: eligible starts serialized corrective send, unknown returns to held. Disposal cancels local scheduling from every state.

## Proposed minimal private Link delivery change

Keep actual Link projection/queue/knownY/settled/disposal and endpoint error-reporting behavior. Extend the prior source-loader transform narrowly:

1. At both admission sites, replace permission-only retained callbacks with revision-aware wake/attempt registration. Held work belongs to the connection and may be superseded. Distinct flush/send keys remain distinct.
2. A send attempt denied for unknown or superseded revision resolves its current attempt as not-started, allowing the existing chain to drain; it does not leave a promise that blocks subsequent flushes. This resolves only the attempt, not eligibility. Link's held/settlement visibility must still represent outstanding latest held work; otherwise `settled()` would falsely resolve. Registration/removal and disposal must be explicit.
3. After `sending=true; observeLink()` and immediately before `endpoint.set(now)`, check captured revision equals the latest eligible revision, current eligibility still holds, and connection/lifetime is valid. If invalid, reset sending, resolve not-started, and let the latest candidate's own flush/wake determine the next attempt. Do not send captured42 after observer writes unknown7.
4. A newer eligible revision wakes/reconciles its connection even if an older held send was registered. Remove/supersede old send ticket without waiting for its unknown evidence to change. Already-started requests remain serialized by actual Link's chain and acknowledgment loop.
5. Keep original retry/error reporting: a thrown/rejected endpoint is reported, and subsequent eligible input can retry. Do not promise automatic retries without input or exactly-once.

Implementation must expose uncertainty rather than fabricate lifecycle hooks. Any requirement that forces replacement of actual Link's queue or reconstruction of a second scheduler is a bounded failure, not authority to expand scope.

## Fixed controls and interpretation

Reuse the previous witness source as frozen input plus a separately named targeted harness. Do not remove or weaken assertions. Preserve previous results as previous candidate results.

- Same-tree paired ingress/control42→7 while x7 pending; unknown direct42 and captured7 remain held even after confirmation.
- Sending observer changes revision to unknown7: no captured42 endpoint invocation; later authoritative9 sends9.
- Inflight42, unknown7, complete42, then authoritative9: exact endpoint sequence `[42,9]`, with no overlap and no unknown7.
- Inflight42 followed by known9 before completion: `[42,9]`, old completion cannot erase new revision.
- Repeated unknown→known replacement while a send attempt was held: newest eligible whole revision progresses; stale callbacks do not send old payload.
- Multiple synchronous ingress revisions before flush: preserve existing coalescing semantics; assert final coherent snapshot, not fabricated intermediate sends.
- Dispose queued work; dispose held work; dispose started42 then replace9: no9 after disposal, started42 uncertainty retained. Verify held/wake callback registries empty, without claiming GC.
- `settled()` remains pending while current unknown work is held; resolves after eligible correction drains or dispose. No false settlement from resolving a denied attempt.
- Endpoint failure then next eligible input preserves actual report/retry behavior and separate-connection progress.
- Tree destroy discriminator retained. If no reliable lifetime invalidation can be sourced within permitted seam, mark failure/unqualified and stop; do not conflate explicit Link disposal with tree destruction.

Record raw requests/start/completion/revision traces, exact source hashes/match counts and commands. Strict-check new standalone policy helpers; distinguish esbuild execution from transformed-source type checking. No native/entity/record qualification beyond previous evidence; no cost/retained-root or production acceptance claim.

## Review questions

Does resolving a denied attempt while retaining held settlement state preserve actual Link's settlement contract without replacing its scheduler? Is final revalidation tied to the candidate revision rather than current payload equality? Can the existing queue safely schedule a correction after an in-flight acknowledgment without a second authority? What existing tree-lifetime signal, if any, can invalidate delivery before destroy flushes notifications? Any unresolved contradiction stops this bounded implementation.

## Frozen pass/fail table (before code)

| ID | Required outcome | Failure interpretation |
| --- | --- | --- |
| D1 paired ingress | Bridge42,7 while x pending; baseline holds until settle | Lost bounded useful progress |
| D2 unknown constant/copy | Remains held before and after unrelated confirm | Any send improperly changes eligibility; continued hold is known unmet requirement |
| D3 observer replaces revision | No stale42; later authoritative9 sends9 | Final revalidation/wake failure |
| D4 inflight→unknown hold→eligible | Serialized42,9, never7 | Held ticket still wedges eligible work |
| D5 inflight→eligible | Serialized42,9 | Acknowledgment loses replacement or overlap |
| D6 repeated held replacement/coalescing | Newest eligible coherent revision; no stale callback send | Queue revision mismatch |
| D7 dispose queued/held/started | No new calls after dispose; started call retained uncertainty | Local delivery terminality failure |
| D8 settlement visibility | Unknown latest keeps settled pending; correction or dispose resolves | Denied-attempt resolution falsely settles or strands waiters |
| D9 endpoint throw/reject | Existing report; next eligible input retries; other connection progresses | Error path strands delivery |
| D10 sending observer throws | Error is observable under existing policy; sending/waiter authority restored; next eligible input can progress | Throw path strands delivery/authority |
| D11 tree destroy | Preserve old discriminator and raw result as inherited unresolved contract | Do not quietly repair or claim Link disposal establishes tree terminality |

D10 is the final added control before implementation. No growing control campaign. D11 is explicitly an unresolved baseline lifecycle contract; this delivery pass must not fix tree destruction opportunistically. Ordinary unknown hold is missing eligibility proof, not merely a wake bug.

Reviewed implementation interpretation: D11 is inherited/unqualified and does NOT stop D1–D10. Completing started42 acknowledges exactly42, then correction9 is allowed. Held visibility uses actual Link-held promise entries, not a private registry. The final guard reads the enqueue-side latest revision immediately after observation. No tree-lifetime claim.
