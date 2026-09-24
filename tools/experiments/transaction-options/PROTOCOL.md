# Transaction options experiment — protocol frozen before implementations

Source baseline: 7ade0e3ecb25ff0d06da4355b5f7d67844e147b7.
Non-shipping research. This does not replace L1–L18, authorize release, or claim
that a model implements actual framework/link/restoration integration.

Every adapter exports `create(options={})`. All operations are synchronous.
Options: `profile: 'live' | 'draft'`, `diagnostics: boolean`, and `seed` below.
Default seed: values x/y/z = 0; one entity ref `original`, key `A`, fields
`{name:'Original',priority:0}`. Entity refs are test-held opaque handles supplied
as labels: the model must preserve lifetime, not infer identity from key.

Operations are recorded assignments, NOT replayable user callbacks:

    {kind:'set', path:['x'], value:1}
    {kind:'add', ref:'new', key:'B', fields:{name:'New',priority:0}}
    {kind:'field', ref:'original', field:'name', value:'Changed'}
    {kind:'rekey', ref:'original', key:'B'}
    {kind:'remove', ref:'original'}

Paths and keys preserve types. String `1` differs from numeric 1; path ['a.b']
differs from ['a','b']. These operations do not assert that arbitrary callback
capture, reactive primitives, serialization, or read dependency inference works.

API:

    begin(ops) -> opaque id             // one semantic unit
    accept(id) -> Result
    reject(id) -> Result
    write(ops, {context:'local'|'external'|'undoable', defer?:boolean}) -> Result
    flush() -> void
    authority({ops:[], order:{kind:'snapshot'|'versioned'|'unordered', revision?:number},
      settlements?:[{kind:'accepts'|'rejects'|'includes', id}]}) -> Result
    read() -> Snapshot
    canonical() -> Snapshot
    draft(id) -> Snapshot               // draft profile only
    state(id) -> {status:'pending'|'accepted'|'rejected', authority:boolean,
      dispositions: ('pending'|'committed'|'superseded'|'rejected')[]}
    observe(callback) -> unsubscribe   // no initial callback; coherent changes only
    link(path, callback) -> unsubscribe // eligible non-pending location values only
    undo() -> Result
    stats() -> {active:number, retainedOperations:number, history:number}
    destroy() -> void

Result: {status:'settled'|'refused'|'already-settled'|'unsupported', reason?:string}.
An unsupported method throws Unsupported with name='Unsupported'; the runner
counts unsupported separately. Unexpected errors are execution errors, never passes.

Snapshot: {values:[{path:[...],value}], entities:[{ref,key,fields}]}.
Test helpers compare order-independent entries while preserving typed identity;
entity order behavior is OUTSIDE this model and must be tested in integration.

`local` writes have local authored precedence and supersede older pending writes
at the same location. `external` writes mean an unrelated authoritative snapshot:
canonical updates, pending remains visible. Authority versions order canonical
payloads; settlement relations are independent. `includes` addresses only the
named contribution; it is NOT an inferred global cumulative watermark.
An unordered payload may refuse unchanged; it may not silently invent precedence.

Structural rejection may refuse where surviving facts require the removed
existence or reversing a rekey would collide. Rekey plus unrelated field edit
must succeed. Refusal preserves ALL state, pending authority and observations.
Terminal duplicate calls may return already-settled, never mutate.

Live profile: proposals appear in read(). Draft profile: read() stays canonical,
draft(id) shows only that proposal against its base. Acceptance in draft uses
authorship precedence or refuses conflicts; it cannot blindly re-author old work.
Unsupported product capabilities do not count as passing live conformance.

Evidence gate: tests and expected traces precede any candidate. First exercise
the runner using deliberate broken doubles; preserve unsupported mutations rather
than calling them killed. No production replacement or architecture winner is
authorized before the complete applicable frozen matrix and mutation proof.
