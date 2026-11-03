# Independent HTTP grant composition review

Verdict: no concrete blocker demonstrated within the optional, loopback-only,
trusted-host, in-memory fixture boundary. This is not production security approval,
browser integration acceptance, durable recovery, a new public API, or release
qualification. Implementation and all original tests remained unchanged. Added
only http/authority-review.test.mjs (six independent tests).

## Raw premises and bounded results

1. Actual server enforcement: http/fixture.mjs:31–33 calls review.apply before
   backend.apply when reviewRequired is true. The fixed transport bearer check
   at lines 15–17 is separate. Raw HTTP requests with grant as bearer, wrong
   bearer plus valid grant, fixture bearer as grant, approved:true/body token,
   and an extra approved field under an existing token all failed with zero
   commits. The original reviewed command then applied exactly once. Body
   authorization fields do not substitute for the x-review-grant header.

2. Exact binding and host control: lines 49–51 issue only through the returned
   test-host control using its captured reviewer identity. /reviews is not an
   issuance route. A token from endpoint A failed at B. Changes to commandId,
   operationId, revision, actor and expected version failed before installation.
   This is bearer-grant possession, not per-request authenticated human identity.
   JSON serialization order is part of the fixture's binding; no semantic
   canonicalization or adversarial host-realm protection is claimed.

3. Idempotent retry: after an acknowledgment was lost following a commit, three
   concurrent retries returned the same applied receipt, commits stayed one.
   Permission revoked after that commit did not invalidate historical receipt
   lookup or permit a new write. Revoking the grant then blocked even cached
   receipt access; the grant gate runs before the backend idempotency lookup.

4. Grant lifetime/recovery: lost persistence-rejection acknowledgment produced
   uncertain, not failed. Revoking its grant kept a subsequent retry uncertain
   and coordinator.dispose refused. Host issuance of a fresh grant for the exact
   same command restored access to the cached rejection, with zero commits and
   unchanged route. Normal operation should retain its original grant until the
   correlated terminal receipt; this test proves premature revocation does not
   fabricate terminality. The fixture does not auto-revoke grants or own the
   caller's coordinator. Caller-side lifetime remains an explicit obligation.

5. Optional mode and independent backend rules: default reviewRequired=false
   accepts ordinary fixture-bearer commands without a grant, and host grant
   issuance reports that the gate is not enabled. This preserves the original
   fixture behavior; do not describe default mode as review-enforced. In enabled
   mode, a valid grant still yields a correlated permission rejection when the
   backend permission switch denies the command. Existing tests additionally
   cover current-input conflict, persistence rejection and changed-content
   command-key reuse. The fixed fixture bearer is not an authentication design.

6. Bounded ownership: 128 grants fill the unchanged authority cap, a 129th is
   refused, revocation releases a slot, and the replacement works over HTTP.
   close() disposes the grant owner; subsequent host issuance/revocation throws.
   Server close is test-resource teardown, not an unresolved-operation guard or
   durable owner transfer. README explicitly disclaims endpoint-close recovery.
   No crash/restart, durable idempotency, distributed execution, or universal
   malformed-input/security proof is inferred.

## Commands and identity

Node 24.15.0, cwd /Users/jonathanborgia/code/signaltree. Local-listener escalation
was used as authorized. No network destination beyond loopback and no external
reviewer CLI. The original nine controls passed independently before additions.
The combined run passed 15/15, no skips/failures. No first failure occurred.

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --test tools/experiments/multi-actor-operations/http/fixture.test.mjs tools/experiments/multi-actor-operations/http/review.test.mjs tools/experiments/multi-actor-operations/http/authority.test.mjs
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --test tools/experiments/multi-actor-operations/http/fixture.test.mjs tools/experiments/multi-actor-operations/http/review.test.mjs tools/experiments/multi-actor-operations/http/authority.test.mjs tools/experiments/multi-actor-operations/http/authority-review.test.mjs
```

Implementation and three original test-file hashes match their pre-review values.
The authority implementation hash matches the previously reviewed fixture.

```text
b5440acc9f41407a51822e26caeefe34f1bcd09d9f8bbb1c41a25cfdff22b120  http/fixture.mjs
8f5358a49791ed3669b595fd86a3b29c3d0c48e96878489e26fb5744e0611a3b  http/fixture.test.mjs
9c7d81b105c09cd6db002aafe3889f535234a2c839c353fd40bcc4453627dfff  http/review.test.mjs
235cd061854a82ac3a62aeac57da82d7365db56f8d1b9140ac6baea2842f0296  http/authority.test.mjs
1d06d5c388c784bfabe92ae32cc16b717de03d69339541a40be6e3f4970de2b5  http/authority-review.test.mjs
653ae035ff584c4832b7b817431c5dd314920b75890de937e8e54d8ba287326f  authority/review-fixture.mjs
096140d4460b8b8e51148444bc4e7c6f5bf3f80f4373f6b0586d46ecd1fa539c  coordinator.mjs
3ba8cd1b48cdfd8c0dbc4936ac4ed806421be2a123813363d9fae70ea008dcb6  dispatch-fixture.mjs
```

## Original nine raw output

```text
✔ real HTTP requires host-issued exact review grant independently of transport credential (24.416041ms)
✔ lost HTTP acknowledgment retains exact grant and command through correlated retry (12.130166ms)
✔ approved HTTP command still revalidates backend inputs and cannot issue grants over transport (11.700375ms)
✔ lost HTTP acknowledgment retries the same command without repeating the effect (20.906667ms)
✔ permission and persistence rejection return correlated failures without installing changes (8.494625ms)
✔ review: forged actor and approval cannot replace host bearer credential (17.793208ms)
✔ review: malformed and overlimit JSON install no state (10.226708ms)
✔ review: command key reuse with different content cannot apply a second effect (14.718958ms)
✔ review: lost acknowledgment of rejection remains uncertain until correlated retry (9.304375ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 131.161

```

## Combined fifteen raw output

```text
✔ independent HTTP: bearer, grant, and body consent are distinct at the server (30.515625ms)
✔ independent HTTP: grant is endpoint-local and all reviewed command fields remain bound (20.9725ms)
✔ independent HTTP: concurrent same-command receipt retries install once; revocation gates cached receipts too (16.118333ms)
✔ independent HTTP: lost rejection stays uncertain through revoked grant until host restores receipt access (8.246167ms)
✔ independent HTTP: gate defaults off explicitly; enabling it does not replace domain permission (3.752292ms)
✔ independent HTTP: grant cap and host teardown are finite, not an unresolved-command recovery owner (6.396334ms)
✔ real HTTP requires host-issued exact review grant independently of transport credential (35.210458ms)
✔ lost HTTP acknowledgment retains exact grant and command through correlated retry (14.83275ms)
✔ approved HTTP command still revalidates backend inputs and cannot issue grants over transport (7.887708ms)
✔ lost HTTP acknowledgment retries the same command without repeating the effect (27.357583ms)
✔ permission and persistence rejection return correlated failures without installing changes (12.752667ms)
✔ review: forged actor and approval cannot replace host bearer credential (29.193708ms)
✔ review: malformed and overlimit JSON install no state (14.480333ms)
✔ review: command key reuse with different content cannot apply a second effect (9.69675ms)
✔ review: lost acknowledgment of rejection remains uncertain until correlated retry (9.861916ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 150.553834

```
