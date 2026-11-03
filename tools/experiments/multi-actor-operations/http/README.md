# Loopback delivery qualification

The fixture starts a loopback-only Node HTTP endpoint on an ephemeral port.
Two executable cases cover an acknowledgment lost after application (retry applies
once) and correlated permission/persistence rejection (no installation). Commands
and idempotency receipts remain in memory; this is not durable storage, production
authentication, crash recovery or exactly-once execution across server restarts.
The fixed bearer token is test-only. Actor labels never grant permission.

```sh
node --test tools/experiments/multi-actor-operations/http/fixture.test.mjs
```

October 29, Node24.15.0: sandbox execution first failed with `listen EPERM` before
assertions. The authorized unsandboxed loopback execution passed **2/2**. This is
infrastructure accounting, not a repaired runtime assertion or performance result.

## Exact review grants across HTTP

The optional `{ reviewRequired: true }` fixture mode enforces the independently
reviewed command-bound grant inside the actual HTTP handler before backend
application. Its host-only `grantReviewForTest` control is not exposed as an HTTP
or agent tool endpoint. Transport credentials alone, `approved` fields and grants
for other commands do not authorize an effect. The client sends the grant in a
header supplied by host integration, retaining it through uncertain retries.

The original six tests, three HTTP grant controls and six independent falsifiers pass (15 total). The added controls
cover absence/mismatch/revocation, lost-acknowledgment idempotent retry, current
input validation, and absence of a transport grant-issuance route. Independent
composition review and a separate main replay pass; see [review and source identities](INDEPENDENT-REVIEW.md). This extends the real HTTP test surface but does
not make the browser reference use HTTP persistence or supply production identity
and durable review receipts. Closing this in-memory test endpoint loses its
fixture grants; production recovery requires the application's durable owner.
