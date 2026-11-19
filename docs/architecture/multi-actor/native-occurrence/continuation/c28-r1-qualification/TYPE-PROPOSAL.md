# R1 spec-type first failure: proposed test-only correction

No source/test edits applied here. Original R1 and independent compiler log remain frozen. Input: `/private/tmp/st-c28-r1-bounded-qualification/runs/spec-types/first.log`: exactly five errors in three files. Source/public-type passes and147 runtime passes are independently reported; they do not excuse these errors or this worker's approved A/B failures.

## Three diagnostic duplicate-key errors

`cached-current-input.spec.ts:56` has TS2783 for name and message; `opaque-current-input.spec.ts:6` has it for message. Both read fallback Error properties and then spread enumerable own Error properties. TypeScript treats Error.name/message as guaranteed spread keys, although normal Error properties are nonenumerable and the fallback is meaningful.

Minimal proposed change only in diagnostic construction:

- `{ name: error.name, message: error.message, ...error }` -> `{ name: error.name, message: error.message, ...(error as object) }`.
- Same `...(error as object)` for the opaque diagnostic's message form.

This erases only the compiler's guaranteed-key assumption for this diagnostic spread; the object is already proven an Error at this branch. It does not cast any public argument, owner, receipt or callback. After type erasure the expression is identical: same getter evaluation order, same own enumerable string/symbol spreading and override behavior. Do not reorder the spread or switch to Object.assign, which needlessly changes details. This is proposed emission equality from source inspection; no compiler/emission check run here.

Preserve original tests/compiler output, then validate a separate successor with the unchanged spec gate and exact public regression/opaque assertions. No assertion or diagnostic field should be dropped.

## Two unsupported public input shapes

`current-capture-r1.spec.ts:16,35`: `updateAndReport({pair: callback})` is rejected. Actual public signature in types.ts:309 is `updateAndReport(updates: Partial<T> | ((current:T)=>Partial<T>)): string[]`. For these trees `pair` is a plain value object, not a function. This recursive per-field callback grammar exists in runtime recursiveUpdate around signal-tree.ts:1136, but the fixture is NOT a valid public typed call. The earlier report's three-runtime-entry-point coverage must not be presented as three supported public typed entry points.

There is no same-callsite publicly typed equivalent demonstrated for these tree shapes. Casting to any/unknown, changing public types, adding ts-ignore/expect-error to pretend positive coverage, or introducing function-valued state would evade or change the question.

Supported behavioral counterpart: replace the recursive route with a root callable route:

`source.$(current => { consume(current.pair); return current; });`

and the analogous `holder.$(...)`. This is fully typed, preserves actual pending input, exact opaque payload identity, all error/hold/settlement assertions, and no new public grammar. Label it `root-callable`; it exercises the existing callable accessor capture seam around489, not recursiveUpdate1136. It complements direct branch callable and root updateAndReport; do not claim it covers the third internal callsite.

Preserve the original recursive cases as explicit internal/runtime research controls outside the ordinary positive-public fixture. The already executed original remains immutable evidence. If ongoing internal-path coverage is desired, use an explicitly private test ingress in a separately classified fixture, reviewed on its own merits; no public cast workaround is proposed here. A test-only successor can keep all12 behavior cases by replacing the route as above, but must document the coverage reclassification and preserve the old source/results. No source exclusion or new runner policy has been applied.

## Separate unresolved contract failure

This typing proposal does not repair or waive approved A/B no-write behavior. In `runs/public-horizon-first` both fresh receipts supersede prior receipts and eventually start/survive. Historical receipts remain superseded; payload delivery is exactly once. Owner explicitly approved the opposite receipt attribution. Preserve that first failure independently of fixture type maintenance.
