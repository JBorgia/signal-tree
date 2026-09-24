# V15 SAFETY AUDIT — published artifacts, not source

> **STATUS — FIXED IN 15.3.0.** Everything below is the measurement as taken on
> 2026-09-23 against published tarballs, and is kept unedited as the evidence
> for the release claim. It describes 15.0.0–15.2.1, NOT current behaviour. The
> contract that replaces it is H1–H9 in
> `packages/kernel/src/enhancers/transactions/hotfix-15-2-2-safety.spec.ts`; the
> fix is in the 15.3.0 CHANGELOG entry. Re-running `probe.mjs` against 15.3.0 or
> later should report NO reproduction.

Run 2026-09-23 against tarballs installed from the npm registry into isolated
consumers. No repo source, no local `dist/`, no workspace `node_modules`.

    npm pack @signal-tree/kernel@15.2.1
      dist.shasum    512ff1a80ae56432e12b89986349506bd4f92b67
      dist.integrity sha512-gN3SMaCqVTHoAFwW8KXH/IKSyp+mA/cbCuzoUFX/Ic8qcdRS6YtWWIzsQSGVHdkcyueecx914eMMz/lMQ/vNkQ==

`probe.mjs` in this directory is the exact program. It adapts to the grammar
rename automatically (`transact` in 16.x, `transaction` in 15.x).

## Result: BOTH defects reproduce in every published stable 15.x

    version   R6 lost authority   R8/A newer clobbered   R8/E resurrection
    15.0.0    REPRODUCES          REPRODUCES             REPRODUCES
    15.1.2    REPRODUCES          REPRODUCES             REPRODUCES
    15.1.4    REPRODUCES          REPRODUCES             REPRODUCES
    15.2.1    REPRODUCES          REPRODUCES             REPRODUCES

Measured values are identical across all four, and identical to the v16 tree.

### V15-SAFETY-1 — R6, lost settlement authority

    pending turns while open            1
    first rollback()                    throws 'effect-validation-failed'
    pending turns after                 0        <- authority destroyed
    confirmed-turn delta                0        <- and not committed
    speculative x                       1        <- still live
    second rollback()                   returns OK, changes nothing
    clear conflict, retry rollback()    returns OK, x STILL 1

Reached with ORDINARY AUTHORED WRITES. 15.2.1 does not export
`withWriteContext` at runtime (it appears only in a doc comment in
`internals.d.ts`), so no internal or privileged API is required: an
application applying a server response with a normal write hits this.

### V15-SAFETY-2 — R8, overlapping pending transactions

    base   x=0 y=0 z=0
    P1     x=1 y=1
    P2         y=2 z=2

    A  rollback P1 -> confirm P2   expected x=0 y=2 z=2   got x=0 y=0 z=2
    C  rollback P2 -> confirm P1   expected x=1 y=1 z=0   got x=1 y=1 z=0  CORRECT
    E  rollback P1 -> rollback P2  expected x=0 y=0 z=0   got x=0 y=1 z=0

A: rolling back the OLDER transaction reverts `y` to its own captured
baseline, destroying the newer transaction's live y=2 — and `confirm()` on
that newer transaction does not restore it. A CONFIRMED transaction silently
loses a field. Nothing throws.

E: both transactions rolled back, neither pending, neither confirmed, and `y`
holds 1 — the value of an already-rolled-back transaction.

C is the control and is correct, so this is not blanket breakage: rolling
back the NEWER transaction behaves correctly. The asymmetry is the diagnosis —
baselines are captured per turn against live state, with no account of which
other pending turn currently owns that value.

## Blast radius

    AFFECTED    @signal-tree/kernel  15.0.0 .. 15.2.1  (all stable 15.x,
                and by inspection the 15.0.0-rc.* line)
                ONLY when the `transactions()` enhancer is installed.

    NOT AFFECTED  @signaltree/core@14.1.3 and the whole v14 line — it ships
                  NO `transactions` enhancer, so no rollback path exists.
                  Verified by import: `typeof transactions === 'undefined'`.
                  No `@signaltree/transactions` package was ever published.

The v14 line is therefore safe and remains maintained.

## Reproduce

    mkdir /tmp/v15check && cd /tmp/v15check
    npm init -y >/dev/null && npm pkg set type=module
    npm install @signal-tree/kernel@15.2.1
    cp <this dir>/probe.mjs . && node probe.mjs
