# Construction enforcement: preserve existing classification
Source check: adapter.ts selects native only when all three existing factories
are truthy. Portable location-runtime.ts uses createToken/runInvalidationGroup;
its writable/derived/epoch constructors do not invoke the three native factories.
Portable tree-scalar-leaf-runtime.ts delegates to those portable locations.
Therefore masks 0–6 remain portable, including unsupported partial native factory
members; their old callable callback reader is a complete neutral representation.
Only mask 7 requires callable createCurrentReadonlyCell, validated by SDK factory
before binding, state traversal, allocation, getters or mutation. No new factory
selection criterion is added. Capability-only adapters remain portable.
Internal signal-tree factory remains portable by default; it binds the new method
and this receiver but does not infer native classification independently.
The native location closure receives that bound adapter; existing epoch hooks are
also bound so changing the closure does not lose native epoch realization.
Tests cover every mask with/without capability, native factory non-use on portable
paths, state getter non-use on rejection, method snapshot/receiver and real taps.
The prior any-method rule is preserved in ENFORCEMENT-FIRST.md and withdrawn.
