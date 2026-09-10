# CAPTURE-SHAPE-0 / CAPTURE-MEMORY-0

> 2026-09-10. Paired per-repetition deltas, alternating order, warmup, strict
> sanity gate. Run on the live notifier path.

## The headline: **shape dominates, not size**

All payloads ~50 KB logical. Capture-isolation variant (payloads prebuilt, so
this is Studio's cost alone):

| shape | Δ ms/write (Studio's cost) |
|---|---|
| A one big string | **0.037** |
| E deep chain (400 links) | 0.198 |
| B flat 500 props | 0.194 |
| D nested tree (depth 8) | 0.288 |
| F Map/Set heavy | 0.362 |
| C array of 500 objects | **0.430** |
| G cyclic graph (400 nodes) | **0.439** |

**~12× spread at equal logical size.** A 50 KB string costs 0.037 ms to capture;
a 50 KB array of 500 small objects costs 0.430 ms.

⚠️ **This overturns the earlier framing.** `S2-CAPTURE-COST.md` reasoned about
payload *bytes* and concluded capture "does not degrade with payload size" —
withdrawn. Size was never the variable. **`structuredClone` cost tracks
node/edge count**, and the earlier string-heavy payloads clone close to a
memcpy, which is why they resolved as noise.

The realistic variant (construct + write + capture) shows the same ordering with
smaller ratios, because payload construction is itself expensive there.

## Consequence: `maxValueBytes` is the wrong control

Bytes are not the cost driver, and worse — establishing a value's byte size
requires traversing it, which *is* the cost being guarded against. Cloning first
and measuring after has already paid the full CPU and peak-memory price.

The evidence points at a **bounded snapshotter** that stops traversal once a
node budget is exhausted, not a byte budget. That is real work and should not be
built until a product decision needs it, but a byte-based control should not be
frozen on this evidence.

## CAPTURE-MEMORY-0

~50 KB payload (array of 500 objects), heap measured with forced GC.

| scenario | expected | retained | truncated | captured heap | residual after dispose |
|---|---|---|---|---|---|
| 50 effects, cap 500 | 50 | 50 | false | 9.0 MB | 9.0 MB |
| 200 effects, cap 500 | 200 | 200 | false | 35.2 MB | 35.2 MB |
| 200 effects, cap 50 | 50 | 50 | **true** | 8.9 MB | 8.9 MB |
| 200 effects, cap 10 | 10 | 10 | **true** | 1.9 MB | 1.9 MB |

**Established:**
- retention grows **linearly with retained count** — ~0.18 MB per effect for a
  ~50 KB payload, roughly 3.6× the logical size because **both `before` and
  `after`** are snapshotted, plus clone overhead.
- **eviction genuinely bounds memory**: capping 200 effects at 50 holds 8.9 MB
  rather than 35.2 MB.

**Dispose release — RESOLVED by [`CAPTURE-DISPOSE-0.md`](CAPTURE-DISPOSE-0.md):
dispose DOES release.** The residual-equals-captured readings here were GC
timing, exactly as suspected, not a leak. Heap deltas were the wrong
instrument; a `WeakRef` probe with both controls settled it.

## Method — the sanity gate earned its keep twice more

**Both** benchmarks initially returned vacuous results, and both were caught:

- Shape: `retained=1/5`. Prebuilt payloads were **structurally identical**, so
  every write after the first was discarded as a same-value no-op. Fixed by
  seeding each payload.
- Memory: `retained=1`. Same cause — and the kernel said so explicitly:
  **`[ST2027] a write to "v" changed NOTHING — the new value is a different
  object but deep-equals the current one`**.

⚠️ The memory gate checked `retained === 0` and therefore **missed** a
`retained === 1` failure. A gate must assert the **expected count**, not merely
non-zero. Fixed, and this is the rule for every future performance fixture.

That is eight unsound-harness catches in this research line.
