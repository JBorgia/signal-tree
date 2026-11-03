# Independent interpretation of the eight recipient-window failures

Exact author freeze: `ae2d5bb7b2be7fe06cadc5bd09c1bba531ca9e305739ca2d06fad238cd5b4378`; baseline C12: `d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2`. Original `recipient-window-independent.spec.ts` and first failures remain unchanged. This disposition does not rely on the new implementation passing its own tests.

## Authority and derivation

The current owner instructions explicitly require “approved enrollmentinvariance”, “recipientpermission nottransfer”, and “Do not ... discard possible foreign holds.” These are distinct obligations. The unchanged approved enrollment tests require the second Link to deliver the same fully supported revision through surviving admission even without its own declaration. They do not authorize that Link to declare the next write independent. Source dependencies/shared validation remain mandatory, and actual possible-owner support must remain until its captured cells settle.

Available historical contract support: exact C12 `docs/audits/2026-10-17-incumbent-readiness/link-declared-contract/SPEC.md`, Admission rule2: “Merely knowing an owner exists elsewhere is not a dependency or a contradiction.” Rule3 prohibits nested declarations from erasing inherited known evidence; rule4 requires failed validation to prevent early publication. That document identifies itself as a draft: it supports the distinctions, but the current owner-approved invariance and safety requirements are the authority here. RELEASE-CURRENT keeps useful automatic independent progress required; this review is not a release-policy change.

In all eight originals the held recipient observes the same independently declared source revision as the immediately publishing recipient. The unrelated owners are not selected destination/input/validation/possible support for that source revision. Holding solely because the recipient did not originate the declaration contradicts the approved six-case invariance requirement. Assigning such a recipient-only window would recreate the rejected enrollment difference. Conversely, removing a genuine native possible window would violate the separate safety premise. The original fixture setup, not just its expected outcome, must distinguish these cases.

## Exact eight cases

| Cases in original file | Why its initial hold is incompatible | Useful coverage to preserve |
|---|---|---|
| branch confirm / branch rollback / root confirm / root rollback (`:8-19`) | p exists on another tree; clean independent branch/root update does not consume it. Both Links observe the same source revision. | A genuinely captured p holds; p confirmation or rollback releases exactly once; later q remains pending and cannot extend that captured window; settled() resolves. |
| confirm / rollback remaining captured owner (`:21-26`) | Neither p nor q is captured native support in this clean independent fixture; both are recipient-window-only additions. | With native W={p,q}, settling p alone must not release; settling q releases once. |
| disposal (`:28-31`) | Recipient B's supposed waiter exists solely because A's declaration was not B's declaration. | Dispose a real held B waiter, resolve it, leave A's receipt untouched by B disposal, never send to disposed B later, and allow A useful eventual delivery. |
| later callback-capable preparer (`:39-45`) | Private preparer opens an unrelated owner after native preparation. Under a complete independent scope, this mere existence is not a new input or validation dependency. | Under genuinely unknown native scope, finalization must include that newly opened owner in W before installation; both recipients hold and later deliver. |

The private preparer case is not a public callback guarantee. It is an internal finalization-order probe. Independent diagnostic replay on BOTH unchanged C12 and the enrollment arm confirms the first source requirement has destination/input/validation=[], invalid=false, unknown=false, possible=[] for independent scope. With unknown scope it has unknown=true and one pending possible cell. These are source facts unchanged by the recipient correction, not inferred from successful sends. Raw observations: `baseline-preparer-proof-observations`, `independent-preparer-proof-observations`.

## Separate counterparts, not weakened originals

`window-counterparts.spec.ts` supplies eight counterparts. Seven create actual native possible support by writing x unscoped while the foreign owner(s) are pending, then consuming that retained branch/root through an updater. Both Links must now hold. That deliberately changes A's initial expected result too: it cannot remain immediately published once it consumes real W. The private eighth uses unknown scope and checks that later-preparer native support actually contains a pending possible owner.

All original useful assertions are retained where their premise still applies: no premature send, partial settlement remains held, exact final payload, one delivery, later-owner isolation/unchanged inspection, settled() release, disposal prevents later send, and isolation of another receipt. For disposal, receipt identity is asserted across B disposal; A's receipt may legitimately advance on later settlement, so the original already-started receipt expectation is not transplanted vacuously.

Executed: **8/8 on unchanged C12; 8/8 on the enrollment arm; 8/8 within the combined safety/progress replay**. This shows the lifecycle controls continue to test real possible-owner obligations across old and new sources. The companion patch is additive. No original oracle or assertion is rewritten. A separate change aligning the clean-native originals could be reviewed later, but is not performed here.

This interpretation does not accept the whole candidate: the newly reproduced equal-final-sibling regression separately blocks it. See REVIEW.md.
