# Small company-workflow preparation

This folder prepares one Angular order/work-item workflow and a controllable local
HTTP endpoint. It does not qualify candidate75416029 or lift the runtime recurrence
stop. No source repository, runtime, controller, package API or customer system was
changed. Angular demo source patterns were inspected at apps/demo/src/app/store/
tree/app-tree.ts, tree/app-tree.provider.ts, ops/post.ops.ts, and
apps/demo/src/app/agent-review-reference.spec.ts in the frozen candidate.

## Executable endpoint

Node24.15.0, no external dependencies:

```sh
cd /private/tmp/v16-company-workflow-preparation
node --test endpoint.test.mjs
node endpoint.mjs
```

Default address http://127.0.0.1:4317; PORT may override. Loopback only. Tests use an
ephemeral port. Route controls return JSON:

| Method/path | Behavior |
| --- | --- |
| PUT /orders/PO-42/items | Validate unique string id/title/status rows; log complete snapshot; apply/ack unless held or scripted to fail |
| GET /orders/PO-42/items | Current process-local applied rows |
| GET /control/log | Request ids, payloads, outcomes, held ids and armed controls |
| POST /control/hold | Hold next PUT; repeat to hold more |
| POST /control/fail | Fail next non-held PUT with 503 before applying; held release outcome is explicit |
| POST /control/release | JSON {"id":1,"outcome":"ack"} or outcome "fail" |
| POST /control/reset | Clear applied rows/log/armed controls; 409 while held requests exist; ids remain monotonic |

Closing the fixture rejects held requests with 503, then closes the server.
Disconnect before release does not apply the held snapshot. Bodies are limited
to64KiB. Logs are in-memory and unbounded for this finite fixture; it is not a
production server. No authentication, CORS, durable persistence, idempotency,
version/CAS checks, lost-ack simulation or external access is provided. A future
Angular dev-server should proxy these same-origin paths; do not open CORS broadly.

## Test results and preserved first failure

`endpoint-first.log`: 2 failures due sandbox EPERM binding127.0.0.1, before any
assertion. Authorized rerun outside sandbox: `endpoint-final.log`, 2 passes.
Assertions cover actual HTTP receive/log, hold without apply, explicit release,
failure without apply, explicit HTTP client retry, reset refusal with pending work,
reset success, malformed rows and shutdown with held work. Event notification
waits for actual receipt; no sleep-based timing. These results test endpoint
mechanics, not SignalTree or browser behavior.

## Consumer preparation and exact blockers

`workflow.ts` imports only `@signal-tree/angular`, matching the intended Angular
facade. It prepares EntityMap editing, transaction inspection/confirm/rollback,
request outcome records and teardown. It does not import private runtime modules,
cast experimental APIs, install global callbacks, or bypass Link for publication.
`SCENARIOS.md` is the finite acceptance table with current blocked dispositions.

No candidate package tarballs or built dist folders were present in the frozen
checkout. `consumer-first.log` records ordinary strict tsc failure: TS2307 cannot
resolve @signal-tree/angular, with consequent callback inference errors. No source
alias or stub type was added to turn this into success. The source is uncompiled
preparation and may require ordinary fixes once real public artifacts exist.

Source inspection proves the declaration blocker independently of installation:
packages/kernel/src/lib/link.ts:143 defines Link with retrieve/settled/dispose;
link.ts:285 annotates link's return as Link; link.ts:1140 attaches experimental
`declare` through a local intersection but does not expose it on that return type.
packages/angular/src/index.ts reexports the kernel public surface.
`declaration-blocker.ts` intentionally accesses connection.declare without any
suppression or cast; run its separate compiler target only after packages exist.
The expected missing-property diagnostic is not claimed as already executed.

`declareIndependent()` and `retryFailed()` throw BLOCKED. No alternative ordinary
write masquerades as a declaration; no direct HTTP replay masquerades as Link
retry. Source inspection at link.ts:119 documents that settled resolves after a
failed set, so application HTTP error recording remains separate from settled.
The fixture only deletes a pending handle after confirm/rollback returns; a thrown
settlement must remain visible for caller handling. Transact-callback failure,
transport cancellation and reentrant observers remain unqualified.

## Later installed-artifact verification

After root permits surviving exact artifacts, install local candidate tarballs
into this folder using normal package installation (no source links, path mappings,
legacy-peer overrides, private imports, module stubs or ignoreAnnotations).
Use Angular22.0.7, TypeScript6.0.3, tslib2.8.1 and esbuild0.25.x as inspected from
this candidate's manifest, subject to actual tarball peer constraints. Record exact
resolved versions and tarball SHA256. Then run:

```sh
npm run check:consumer
npm run check:declaration
npm run bundle:consumer
```

The declaration probe must remain a failure until the public capability is
properly delivered; bundling success alone is not runtime qualification. The
package.json is intentionally private and has no guessed tarball dependencies.
No dependencies were downloaded and no packages built/published in this task.
