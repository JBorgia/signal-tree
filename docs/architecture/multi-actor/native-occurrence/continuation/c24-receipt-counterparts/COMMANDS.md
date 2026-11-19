# Deferred replay; not executed here

From Main's frozen disposable candidate already containing both original test packets:

```sh
git apply /private/tmp/st-c24-receipt-counterparts/receipt-only-correction.patch
git apply /private/tmp/st-c24-receipt-counterparts/authored-held-disposal.patch
pnpm nx test angular equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
pnpm nx test vue equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
pnpm nx test solid equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
pnpm nx test react equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
pnpm nx test kernel equal-owner-public-adversaries authored-held-receipt-disposal --skip-nx-cache --maxWorkers=1
```

Node24.15.0/pnpm10.17.0; isolated Main-owned outputs/cache/TMPDIR and existing qualification controls. Facade targets should select8 each; kernel selects6+1. Preserve original tests elsewhere, raw first results and frozen candidate identity. No automatic retry or assertion adjustment. Spec types remain a separate existing gate. Execution completes requested observability only, not retention acceptance.
