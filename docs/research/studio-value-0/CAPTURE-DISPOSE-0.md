# CAPTURE-DISPOSE-0 — does dispose release retained evidence?

> 2026-09-10. A lifecycle/correctness property of the lease, resolved before
> building layers on top of it.

## Property

> After the lease is disposed, and no caller retains a snapshot, Studio itself
> retains no strong reference to captured value clones.

## Result — **PASS. Dispose releases.**

`WeakRef` on the **clone Studio retained** (never on the source object, which
the tree legitimately still holds), under `--expose-gc`:

| row | alive? | meaning |
|---|---|---|
| **negative control** — unreferenced object | `false` | the harness *can* observe collection |
| **test** — disposed, no caller reference | `false` | **released** |
| **positive control** — deliberate strong ref | `true` | the probe *can* observe liveness |
| active lease, no caller reference | `true` | expected — evidence legitimately retained |

Both controls are required and both pass, so `false` on the test row means
release rather than a blind instrument.

This also settles `CAPTURE-MEMORY-0`'s open item: residual heap equalling
captured heap there was **GC timing, not a leak**.

`registerCleanup(dispose)` does leave the disposal closure registered on the
tree until destruction — that is fine, and is what the property was written to
check: the closure no longer retains captured values, because `dispose()` clears
the effects array.

## ⚠️ The first two runs were void — ninth unsound harness in this line

**Run 1** reported `disposed → alive` and I nearly recorded a **leak**. It had a
positive control (strong ref stays alive) but **no negative control**, so
"alive" could not be distinguished from "GC never ran".

**Run 2** added the negative control, which **failed**: an object with no
references at all reported alive. The harness was blind, and every earlier
reading was meaningless — including the leak.

**Cause:** `globalThis.gc()` interleaved with `setImmediate`. V8 needs a
**macrotask** window; switching to `setTimeout(…, 25)` and allocating inside a
callee (so no live stack slot in the caller) made collection observable.

The lesson generalises beyond GC: **a positive control alone is not enough.** It
proves the instrument can see the condition present, not that it can see the
condition absent. `RESEARCH-RULES` R1 is updated accordingly.
