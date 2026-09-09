# studio-devtools

SignalTree Studio DevTools UI. **Private — never published.**

**Status: S1 scaffold.** One screen: select a transaction, see what it actually
committed.

```text
Transaction 31  (tree-0001)

COMMITTED NET CONSEQUENCE
  cart.promoCode
    null -> "SAVE20"
  cart.discount
    0 -> 2400
  cart.total
    12000 -> 9600

NOT OBSERVED BY THIS SLICE
  - attempted writes that did not survive (net effects only — MO-1B)
  - pending or discarded transactions (S1P)
  - external/realized truth (S2)
  - restoration lineage (S3)
  - nested and entity-structural composition (S4)
```

The view states its own edges. Spec §22.1.11: unsupported compositions are
refused, never silently omitted — a newcomer who trusts a confident partial
answer is worse off than one who got none.

The screen is a pure projection so the semantics are testable without a DOM;
the panel shell renders it and does not compute it.
