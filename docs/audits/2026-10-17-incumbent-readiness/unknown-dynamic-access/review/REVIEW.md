# Independent type-migration review

Reviewed candidate core SHA-256: f4b10a8d051bc8f2a766c426c61897d5bf4f5c50349a8989deea6fd282b36b33
No edits to repository or candidate source by reviewer.

Disposition: no remaining concrete blocker in the reviewed open string-indexed Record scope.

Preserved first findings:
- first.log: callable Function native names call/name/length remained non-unknown despite unknown string index. Native-only unsoundness predated migration; migration had not closed its promised boundary.
- final-core.log: mutable Function-key mask weakened readonly hybrid bind. This was a candidate regression.

Both corrections independently rechecked in final-core-recheck.log (strict compiler exit 0): explicit readonly unknown mask covers CallableFunction keys; named hybrid leaves intersect to exact carriers, readonly bind stays readonly. Candidate test files additionally cover known mutable name assignment and readonly bind across all five facades.

Independent probes preserve: arbitrary Record<string,V> and Readonly<Record<string,V>> access unknown; native collision names unknown; known hybrid title/count/nested and numeric-literal/unique-symbol children remain typed; readonly known child remains readonly; known hybrid name/call/length/bind return their exact value types. Original whole-write constraints are retained in five facade fixtures. No runtime or exports changed by this core type change.

Limits: Record<number,V>, Record<symbol,V>, and template-pattern index signatures retain existing behavior; they are outside this bounded string-extends-keyof-T migration. Do not claim universal open-key soundness. This independent compiler probe is not installed-package or full release qualification. Existing runtime evidence and expected failures remain separately preserved.

Evidence directory: /private/tmp/st-unknown-access-review
Strict replay: Node24.15.0 node /private/tmp/st-unknown-access-candidate/node_modules/typescript/bin/tsc -p /private/tmp/st-unknown-access-review/tsconfig.json
