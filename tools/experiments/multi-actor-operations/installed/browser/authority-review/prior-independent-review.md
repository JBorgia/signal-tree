# Independent authority fixture review

Verdict: no blocker demonstrated within the declared trusted-host, single-process, in-memory fixture boundary. This is not production security approval, browser integration verification, public API selection, or release sign-off.

## Identity and scope

- Checkout: /Users/jonathanborgia/code/signaltree
- HEAD: 628d302dadb082a48c58528651c9088234d0a777; branch fix/d1-d2-forward-port.
- The experiment directory is untracked. The two requested files have no tracked HEAD baseline or file history; their complete current contents are the reviewed additions (33 implementation lines, 49 test lines). Ordinary git diff is empty for these untracked paths, not evidence of no changes.
- Read docs/review-contract.md and authority/README.md. Reviewed authority/review-fixture.mjs and review-fixture.test.mjs, coordinator.mjs immutable() lines 2–30, and DispatchBackend including its apply path. No other reviewer reports were read; no external reviewer CLI or transmission was used.
- Unrelated dirty files and experiment material were left unchanged. Only authority/independent-review.test.mjs was added to the checkout. No implementation or documentation edits.

SHA-256 of reviewed source inputs (unchanged at end):

```text
653ae035ff584c4832b7b817431c5dd314920b75890de937e8e54d8ba287326f  authority/review-fixture.mjs
0c8d1ffaeae7f27b4fe460b92ce16c2a7fba16cb6f69e247d13e43d804d5e492  authority/review-fixture.test.mjs
096140d4460b8b8e51148444bc4e7c6f5bf3f80f4373f6b0586d46ecd1fa539c  coordinator.mjs
3ba8cd1b48cdfd8c0dbc4936ac4ed806421be2a123813363d9fae70ea008dcb6  dispatch-fixture.mjs
```

## Bounded conclusions and falsifiers

1. Command binding and host authorization hold for tested inputs. review-fixture.mjs:13–21 captures immutable data before host authorization, requires literal true, then stores serialized content under a random token. Lines 25–28 recapture and compare before invoking the backend. Ran falsifiers changing command ID, operation ID, revision, nested patch/version and approval fields: all refused, zero commits before the original command applied. Mutation by the authorization callback also failed to change the captured grant. Forged context is covered by the original suite; truthy non-true results, a resolved Promise and a thrown host error were tested independently. No grant bypass demonstrated.

2. Reentry, retention cap and lifecycle hold for the tested synchronous paths. review-fixture.mjs:18–19 rechecks disposal and capacity after host callback execution; lines 30–31 remove grants. Original test disposes during authorization and observes refusal. Independent nested authorization fills maxApprovals=1; the outer call fails at capacity. Proxy-triggered revocation/disposal during apply capture prevents a backend commit. Revocation blocks use even after a command committed; it does not reverse that commit. No cap overrun or post-disposal mint/use demonstrated.

3. immutable() rejects accessors without executing them, cycles, undefined, NaN, Date and a callable toJSON in the independent tests. coordinator.mjs:18–25 copies own data descriptors into frozen output rather than retaining input aliases. No executable getter or serialization callback reached the backend in these tests. This is data capture, not a sandbox against code that already controls the host realm. Exhaustive Proxy behavior and global intrinsic tampering were not tested.

4. Backend validation and idempotency preserve the exercised boundary. dispatch-fixture.mjs:36–44 checks permission, entity, patch types and version preconditions before any update; lines 45–54 decide persistence then update synchronously. Ran approved malformed/wrong-entity/missing-version/unknown-read/mixed-valid-invalid patches: rejected without partial changes or commits. Original tests establish current permission and version-conflict rejection. Independent persistence failure remains a cached rejection even after permission is restored. Lines 25–29 replay identical prior receipts and reject changed content with the same command ID; independent tests verified both and commit counts. A successful prior receipt can replay after permission is disabled, with no new write: consistent with the README's explicit retry semantics, not a fresh permission bypass.

No concrete violated contract was found, so there are no implementation findings requiring correction in this bounded review.

## Execution evidence

Used repository-pinned Node 24.15.0. First ran the existing suite alone: 4 passed, 0 failed. Then ran:

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --test tools/experiments/multi-actor-operations/authority/review-fixture.test.mjs tools/experiments/multi-actor-operations/authority/independent-review.test.mjs
```

Result: 12 tests passed, 0 failed, 0 skipped (4 existing, 8 independent). No first failure was encountered or suppressed. Tests assert state/commit outcomes, not only absence of exceptions. Input hashes and HEAD were checked again after execution.

Not run: production/Nx/release gates, HTTP/browser integration, durable storage/restart, distributed concurrency, human-presence/remote-attestation checks, memory stress/GC measurements, exhaustive fuzzing, or proof of random-token uniqueness. These are outside this finite fixture review; no results are inferred for them. README explicitly excludes production identity, durability and browser adoption, and assigns receipt retention separately to the backend. Holding a valid grant is bearer authority; reviewer authentication is the trusted issuance seam, not per-apply identity verification. Direct access to the trusted backend remains outside the gate. Those declared boundaries were not promoted into generic auth requirements.
