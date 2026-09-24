# Authority cases — preregistered before candidate execution

Scope: frozen TRANSACTION-SEMANTICS-2 L11/L12 and MATRIX A1–A6/T18–T22; no retention, law, adapter, prototype, or production changes. History c280e5d0 explicitly separates authority order from settlement relation and fixes revisions as numbers. Initial scalar state is {x:0,y:0,z:0}. P writes y=1; Q writes y=2. Every intermediate write/event is flushed. The same test module runs on working source and immutable HEAD 7ade0e3ecb25ff0d06da4355b5f7d67844e147b7.

Exact assertions, fixed before implementation execution:

| Case | Operations | Assertions |
|---|---|---|
| A1 | P; snapshot y=7, relation none | visible y=1; P pending with authority; canonical y=7 |
| A2 | P; snapshot y=1, accepts P | visible y=1; P committed or superseded and no authority; canonical y=1 |
| A3 | P; snapshot y=7, rejects P | visible y=7; P rejected and no authority; canonical y=7 |
| A4 | P; snapshot y=9, includes P | visible y=9; canonical y=9. No unique terminal label is required: MATRIX says P *may* be superseded. If P retains authority, later successful accept must not resurrect y=1; otherwise no duplicate settlement obligation is invented. |
| A5 | revision2 y=0; P; revision10 y=7, no relation | visible y=1; P pending with authority; canonical y=7; numeric 10 follows2 |
| A6 | revision10 y=7; revision2 y=2 | canonical and visible y=7 |
| T18 | revision2 y=2 then revision10 y=10 | canonical and visible y=2 at first checkpoint, then10 |
| T19 | revision10 y=10 then revision2 y=2 | canonical and visible remain10 |
| T20 | P; Q; revision11 y=1 with accepts P | visible y=2; P committed/superseded and no authority; Q pending with authority; canonical y=1 |
| T21 | revisions 2,11,10 with corresponding y values | canonical and visible checkpoints2,11,11 (numeric, not lexical/arrival order) |
| T22 | P; unordered y=9, no relation | P remains pending or explicitly conflicted and retains settlement authority; canonical remains baseline0. No visible-value policy is prescribed for an explicit conflict. Unsupported/unknown capability is recorded as unsupported, never pass. |

For no-pending numeric cases visible evidence is recorded even when canonical reading is unsupported. For A1–A5/T20/T22, visible/settlement/canonical claims are separately recorded; unsupported readers do not erase earlier violations or suppress independently executable assertions. Unexpected exceptions remain errors. Unsupported authority ingress stops dependent assertions; no simulated revision/frontier/overlay is installed.

Instrument controls use scripted method returns, never a candidate implementation: held constant trace; corrupted visible/canonical/settlement/retained-authority/numeric checkpoint; refused settlement; missing canonical capability; unsupported ingress; thrown operation/construction/disposal. A refused success obligation is violated, not held; unsupported and errors remain distinct, nonzero outcomes. Positive scripted controls prove only instrument reachability, never semantic conformance.

Predictions: current and immutable HEAD lack native canonical reads, revision ordering, and correlated settlement mapping. A1 likely also shows visible overlay loss; its violation must survive the unsupported canonical read. T22 must not receive a green verdict merely because native pending membership survives. These are predictions, not substitute outcomes.
