# Independent successor contract / prewritten-test review

## Scope and disposition

Read-only review against runtime `2dacae7b9e9137018d05c4e00382ac9287bc76d4` and owner AUTHORITY at `75c645eb71e4a03e5c84491ce8078debfe797e19`. Runtime was unchanged; the only later checkout additions observed were new test files. I read the governing raw authority, SPEC, the two membership/window plans and executable drafts, and the subsequently supplied separate-boundary plan/spec. No other reviewer verdicts, implementation edits, executions or models by this reviewer. The earlier omission falsifier was my work; that prior involvement is disclosed.

**The fixed-window policy is authorized at specification level, and the main proposed outcomes follow it. This packet still needs the bounded clarifications below before it is a complete implementation contract.** In particular, transfer of an unresolved possible window through a subsequently consumed native input must not be left to implementation. Source/projection uncertainty, possible blockers and known dependencies must remain distinct.

Reviewed initial central SPEC hash `a8d6cb9cf95a5a6e73e4282e27d600a71e22a2bf7fec50ef23e48dedb474bf49`. Reviewed corrected membership draft `f46aeef375e5a4f193b13e3edcff62ddbf4f8afa1d4689490df56fc3d5212d3e`, window draft `6c7ccb3592089f0d8fb4e25bc7f751378fcee081d86ad53122717610f92359d8`, separate-boundary draft `67cbeaee99c14287d4b59532edfe50bce5035a53f45873d55aaf8f64a4bd7966`. Review changes should preserve this first review.

## 1. Specify possible-window transfer at actual native consumption

SPEC's record table says native facts constrain projections containing **or consuming** them, but windows constrain “that revision and projections containing it.” The later replacement rule is not sufficient to distinguish genuine fresh literal replacement from a new value that consumes an unresolved input.

Small discriminator: source ordinary x7 is authored with unobserved inputs while foreign p is pending, hence receives a possible-p window. A later qualified target declaration consumes that x through a supported native updater argument and writes a derived value. Does its resulting fact retain the input window, or can a complete independent label clear it? The window must not become a proven native p dependency merely because the input was consumed; that would manufacture a declaration contradiction from possible origin. Conversely, treating it as recipient-only uncertainty and dropping it can erase the intended conservative obligation. A fresh literal replacement that does not consume x is a different operation.

State the transfer rule and prewrite the paired consume-versus-replace oracle, including owner settlement and later unrelated q. The current 17 window cases do not cover this native-consumption composition. They test direct hidden reads, which have a different completeness boundary. **No test run for this discriminator.** This is a concrete missing obligation-transfer rule, not a request to instrument arbitrary getters.

## 2. Tighten the authorship/metadata reprepare boundary

SPEC admission3 correctly rejects delivery-time owner sampling, callback replay and new public refusal policy. Its “reprepare metadata” sentence needs a precise unit boundary:

- Use the existing native installation unit. An ordinary outer branch call may already have installed earlier constituents; their windows cannot be enlarged by preparation reentry for a later constituent. A selected atomic realization retains its existing selected-unit boundary.
- Keep the updater's original supplied descriptor and returned value. Refresh only uninstalled pure metadata against the validated source/owner epochs immediately before callback-free installation.
- Do not silently rerun callback-capable participant preparation or reclassify already-installed facts. A source-identity conflict follows the existing validation/refusal contract; a new retry/refusal semantic requires stopping.

The supplied p/write/q tests exclude later delivery sampling, but do not exercise an owner opening during equality/preparation, nor the already-installed-earlier-constituent case. Add prewritten expectations for those before implementing this requirement. These are **missing tests**, not newly demonstrated runtime failures. Frozen scalar preparation already detects physical revision changes; owner-only reentry is not equivalent to that source mutation case.

## 3. Make the native entity boundary explicit in central SPEC

MEMBERSHIP-TEST-PLAN correctly says ordinary `rows.ids/all/count/empty/activeEntity` or held-reference reads inside an arbitrary declaration are not automatically supplied native arguments. Central SPEC's “Supplied/read fact” table should explicitly retain that limitation. A native producer can describe its result, but that does not prove a later setter consumed the result or carry a hidden callback's completeness.

The existing row updater really supplies a row argument (`entity-signal.ts:2975–2994`); that port can require row value/membership/lifetime certification. Direct query getters and cached projections do not become an ambient publication read port merely because a declaration is executing. Selection, sorted order, query predicates and saved results therefore need either an actual supported supplied-input route or an explicit unavailable/hidden-input classification. No fake collection callback API is justified by the inventory. Entity integration is an explicit future obligation, not coverage established by these scalar/branch tests.

## Membership fixture correction verified

The initial reactivation fixture left a confounding possible known p requirement on y: a live source connection existed while p's replacement explicitly supplied equal y0. `signal-tree.ts:1163` avoids the equality shortcut when publication preparation is enrolled; native preparation attributes the installed support to p. Reactivating only x cannot clear y's support, and the next whole-object input includes y.

The corrected fixture explicitly independently authors y1 alongside held x7 before consumption. This isolates positive membership supersession while retaining the held identity assertion and useful target1/declared outcome. That is a justified new-fixture correction, not weakening the unchanged omission falsifier. The plan also correctly stopped calling identity-return probes necessarily nonauthoring: they may install support-only units. The own-key helper change preserves semantics while accommodating the project's existing library target. FIRST retains original source and results.

## Prewritten coverage and evidence limits

The drafts contain **54 membership + 17 window + 5 separate-boundary cases**. The original omission2, registration3 and mixed-undo1 are inherited unchanged cases, not newly invented coverage. TESTS.md appropriately lists additional native entity, retention/work, framework, failure/reentry and internal-ticket checks as future obligations. Replace its separate-boundary “See result” count with the prewritten count5; no execution is needed to know that count.

The membership vector is useful: three real native supplied-input writers, six absence observations, enrollment variations, equal-support primed cache, undefined/presence distinction, dormant-payload exclusion and corrected same-member reactivation. It does not cover never-present keys directly, symbols/prototype boundaries, nested absent ancestor combinations, P/O cache mismatch, entity lifetime/order, or framework-native cached inputs by itself. These are not disproven by the draft, but must remain explicit planned coverage rather than be credited to 54 cases.

The window vector faithfully includes fixed p/write/q capture, empty window, multiple owners, successful rejection with surviving value, restoration, inspection exclusion, replacement, qualified progress, reentry, queued/in-flight serialization and disposal. Its explicit late target-local gate preserves the authorized exception to late-foreign-owner exclusion. The raw rejection oracles agree with approved surviving-write semantics: fresh coherent O may send the same number without a new setter, but never by confirming an old proof. The unresolved destruction case asserts no false confirmation and permits disposal to end the waiter; it is not an auto-drain claim.

The separate-boundary tests exercise reverse constituent order, disjoint-field callback authorship, queued stale preflight, in-flight serialization and multiple optional participant release. They preserve useful sends and current physical state. The participant test does not establish throwing preparation atomicity or deterministic prepare order; inherited refusal tests and additional before/after-native controls remain necessary. Tap callback tests do not replace native invalidation/effect or synchronous observer reentry controls. Their plan acknowledges those limits.

Parent's FIRST/native.log was inspected: **40 passed / 33 failed across73**, frozen runtime, original membership54 + window17 + omission2. This is baseline evidence, not33 independent defects: three initial reactivation cases were fixture-confounded, and six new Object.hasOwn diagnostics were fixture type errors. No result from that run qualifies the corrected fixture. No baseline result permits changing inherited assertions. This reviewer ran nothing and made no implementation or activation recommendation.
