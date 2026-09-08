# STUDIO-VALUE-0 — applications

**NON-SHIPPING RESEARCH FIXTURES.** Not part of any published package.

```text
backend/     shared by BOTH arms — arm-neutral by construction
ngrx/        not started — see BUILD-SCOPE.md design issue 4
signaltree/  not started
```

## Backend

```bash
node backend/server.mjs          # http://localhost:8787
```

| | |
|---|---|
| `GET /carts/88213` | current state |
| `POST /carts/88213/promo` | `{"code":"SAVE20"}` — validates, applies tier cap, returns authoritative state |
| `POST /jobs/expire-stale-promos` | maintenance job — **carries the injected defect** |
| `GET /events` | SSE push channel |
| `GET /__evidence` | mutations + spans + service log, for freezing |
| `POST /__reset` | reset between runs |

Verified end to end:

```text
initial   subtotal 12000  discount 0     total 12000   rev 3301
promo     subtotal 12000  discount 1800  total 10200   rev 3302   (nominal 2400, silver cap 1800)
job       subtotal 12000  discount 0     total 10200   rev 3303

12000 - 0 = 12000  !=  10200      <- invariant violated, the defect
leaky log lines: 0
```

## Evidence rules this backend enforces

- **Facts, never conclusions.** No log line names the defect, references a
  ticket, or explains what a job failed to do. The maintenance job logs
  `fields: ["promoCode","discount"]` — the omission of `total` is visible in the
  patch, not narrated. This is the defect that made the previous synthetic
  fixture inadmissible.
- Money in **integer minor units** with an explicit `currency`, not JSON floats.
- Mutations carry `actor`, `sourceService`, `reasonCode`, `schemaVersion`,
  `cartRevision`, `requestId`, `traceId`, `spanId` — machine fields.
- Push frames carry `messageId`, `channel`, `cartRevision`, `traceId` and a
  `producerSpanId` so a client can span-link rather than squat on the job's
  trace id.
- Per-aggregate `cartRevision`, monotonic, so a client can detect gaps.

Both arms hit this exact implementation, so the server side is identical by
construction rather than by care.
