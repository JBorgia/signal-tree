# Wider native input: declaration versus ordinary fallback

Independent design-only adjudication. Frozen runtime checkout `/private/tmp/link-a1-successor-experiment`, HEAD `2d71d73305fea23173b3b681c2a897ef1a7dffba`. No runtime/test/model edits or execution. I read approved A0, the authored-input premise and actual test/source; no other new review verdict was consulted. The original assertion/red must remain preserved.

## Determination

The test's **no declared early grant** expectation follows from unavailable wider-input coverage. Its stronger **no send until an unrelated foreign transaction settles** expectation does **not** follow. Applied to ordinary fallback, that requirement conflicts with the preserved tree-local conservative gate unless an actual foreign dependency or unresolved relevant validation obligation is established.

This is not authority to mark unknown input independent, strip known foreign owners, or call the current wider-input path safe. The original test conflates two permission bases; it cannot by itself establish a leakage defect from its endpoint observation.

## Exact sequence and controlling premises

`aggregate-installed-publication.spec.ts:126–133` creates owner tree z, recipient tree t, and a Link observing only t.pair. Owner.z opens p=7. An independent declaration on the pair connection invokes a **root** updater on t, which receives `{pair,x,y,z,w}` and writes pair.x from the root's ordinary x. The pair binding cannot certify the complete root argument. Nothing in this exact body reads owner.z, declares p as a dependency, copies a foreign proof, or authors a pending transaction on t. The test requires sent[] and conservative/unknown until p rolls back.

A0:23: “Default automatic Link remains conservative.” This preserves the default gate; it does not make it global.

`commit-consequence.ts:35`: “The gate is TREE-LOCAL, so a transaction open on tree B never delays tree A.” Its documented primitive at178–186 holds for an attributable owning scope or any open scope **on this tree**, otherwise runs now. `scheduleDurableConsequence:213–225` resolves the claimant's registry and consults that scope key only. This is deliberate load-bearing behavior, not an accidental absence of a global scan.

A0:50 qualifies baseline-safe support with “no known foreign support prevents it” and permits a conservative new baseline from “a fresh coherent surviving projection after its actual gates pass.” This preserves known foreign lower bounds but does not manufacture such a bound from unrelated activity.

A0:54–58 distinguishes known native input requirements from declaration coverage: “A valid independent declaration contributes no declared owners; it cannot clear known support.” Payload permission uses every contributing fact/horizon. Thus wider argument uncertainty defeats the **declaration** grant; the callback label cannot certify unrepresented native arguments.

A0:157: missing input history/enrollment evidence uses unknown, “must still drain under the supported ordinary gate,” and “does not count as a useful early-progress pass.” The authored-input premise agrees that genuinely uncovered input stays conservative and is not a useful declared-progress pass. Neither passage says unrelated foreign scopes become the ordinary gate.

The explicit owner decision preserved in A0:11 allows conditional progress through complete declarations with hidden-input omissions owned by the application. It does not waive the native updater argument lower bound, but also does not replace existing automatic tree-local semantics with universal causal inference.

## Two distinct observations required

1. **Declared authorization:** unknown coverage must produce no `basis:'declared'` send and cannot be used as an input proof/grant by a later operation. No other recipient's cleaner proof may fill that gap. Passive enrollment of another connection cannot alter this recipient's native inputs.
2. **Ordinary authorization:** after the declaration horizon closes, a fresh current coherent ordinary projection may pass the existing tree-local gate if no known contributing foreign owner, invalid source support or relevant validation remains. This is a `basis:'surviving'` consequence; it is not proof that the declaration was complete.

Current lifecycle distinguishes these at `lifecycle.ts:130–135`: started receipts have basis declared/surviving. `private.ts:202–213` likewise has direct early execution versus `original(...)` scheduling, where the latter records a relationship grant. The exact candidate currently can send through that ordinary branch. Endpoint value alone does not establish which branch authorized it. Receipt state may consequently become started/surviving rather than permanently conservative/unknown after a valid ordinary fallback; inspecting the basis is necessary.

Source observation is not acceptance: current `private.ts` combines unknown causes in one proof and drops global captured blockers for a complete declaration. This must not cause a **known** foreign requirement to disappear, nor permit an obsolete payload or invalid validation horizon to gain a surviving grant. Conversely, retaining every globally pending owner as mandatory for all unknown inputs would contradict tree-local fallback and passive noninterference. The successor design must distinguish absence of early evidence from a positively known unresolved/invalid dependency.

## Minimal distinguishing controls to freeze before runtime work

- Exact original wider-root/pair sequence, with p on unrelated owner tree: preserve old no-send assertion/red; a separate adjudicated control records declaration decision, scheduler entry and receipt/send basis. Require no declared grant; only tree-local surviving fallback may explain a send. Do not count it as useful declared independence.
- Same wider-root input while **t itself** has an unrelated pending transaction: unknown must remain held under the ordinary gate until that local scope settles, then publish current ordinary truth without synthetic value events.
- Full-coverage same recipient and truthful independent updater: require useful declared-basis publication while a relevant unrelated local transaction remains pending. This prevents fallback from masquerading as the required capability.
- Known foreign pending dependency actually contributes to t's authored result (authentic p via the existing declared/native input mechanism): no declared or surviving fallback while p is unresolved, despite no local t scopes. Confirmation can release only a fresh coherent current ticket.
- Known foreign dependency rejects or becomes invalid: old speculative payload/ticket cannot be released merely because the local gate is empty. Reevaluate current surviving ordinary truth under approved rejection semantics; a fresh later ordinary literal write is a separate authorship control.
- Foreign-only enrollment uncertainty with no source mutation: adding/removing a passive relationship cannot alter the first relationship's proof or ordinary gate. No best-proof or union-all selection.
- Unresolved outer validation / nested cross-connection declaration: no fallback before all relevant horizons finalize. Invalid enclosing validation cannot become an early grant; writes remain conservatively retained under existing error semantics.
- Queued/in-flight ticket supersession: ordinary grant covers one exact current projection revision, never a later or historical payload; serialized corrective delivery stays intact.

These controls specify permission basis and actual dependency relevance, not changed application visibility or inverse semantics. Production hold remains unchanged. Design adjudication alone does not lift the recurrence stop or authorize a runtime correction.

## Source identities

- Approved A0 (tmp and readiness archive byte-identical): `942c14563096ca29ba90a8a27a5bab65b139fba068cfd10ec96b68aab1365e42`.
- `link-a1-aggregate-successor/INPUT-PREMISE.md`: `38a1a1456d0e72f08138cb7340ab434903cb2aa6b76de49cb9ab50f4a4810f2b`.
- Frozen original wider assertion source: `821b525ff50cb1ce124fc0230cd336f718eec2376a9c3ccd20d10866c6e3aabf`.
- `commit-consequence.ts`: `bfe4abc380b25859d3964dd08e714f199abe6bda881c27fe1165f2ac5f86e523`.
- experimental `private.ts`: `73f58da9919a92649f1741790b933cd3f0bb20e72a4c1dd7cb5de0d5fcfaf8ac`.
- experimental `lifecycle.ts`: `a17ce73e377489ee90345d55aa710c3cb013aef8fea36bc492a84fe885fbd42e`.
