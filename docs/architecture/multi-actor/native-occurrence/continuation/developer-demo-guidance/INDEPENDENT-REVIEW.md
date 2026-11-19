# Bounded public demo source review

**No runtime/API blocker demonstrated. One small tutorial wording correction is warranted for repeat use.** Reviewed seven-file overlay/patch, actual component/template/spec, route/nav changes and checker. No execution, compilation, browser, library suite or build performed. Worker parse-check claims are not runtime proof.

## Concrete finding

`independent-publication.component.html`, instruction3: “Reject the route to restore north” is true for the initial proposal only. After a user confirms west, the controls allow another proposeWest(); rejecting that proposal restores its prior route (west), not north. Prefer “Reject the route to restore its previous value (north on the first proposal), or confirm it to keep west.” This is a text correction; no reset feature or transaction semantic change is needed. The current tests exercise fresh components and therefore do not cover repeat-confirm-then-reject wording.

## Reviewed behavior

- Route uses loadComponent and matches the navigation entry; existing navigation expectation adds only the new path. Public page imports Angular core and @signal-tree/angular, with no private SDK or source imports. Route, nav and page distinguish v16 preview; page says unreleased and not stable v15 guidance.
- The declaration writes only the authored literal to the owned note leaf while a separate route transaction is pending. The callback is synchronous; awaiting settled is outside declare. It neither reads nor copies speculative route input. Saved/hidden/cached inputs are correctly warned against rather than declared automatically safe.
- Three distinct displays show visible state, an explicitly sampled admission snapshot and the actual synchronous in-memory endpoint signal. Admission is not mislabeled as delivery/durability. Receipt snapshots are stored in an Angular signal, so OnPush rendering does not rely on the receipt itself being reactive. Independent repeated equal authorship is expected to yield no-write without duplicate delivery, not to approve old obligations generally.
- publishing prevents overlapping actions and local settlement while awaiting the note. The try/catch handles declaration/read/settlement rejection, displaying an error and releasing publishing in finally while alive. There is no claim that settled rejection reports all endpoint failures; the endpoint here only appends to an in-memory signal. Synchronous propose/confirm/reject exceptions remain normal event errors; no concrete failure path for this bounded literal/no-conflict scenario was demonstrated.
- ngOnDestroy is idempotent, marks destroyed before disposing Link then destroys the tree. Late action calls return early; async completion avoids post-destroy admission/error/publishing updates. Endpoint set is synchronous and contains no delayed continuation. This is sensible component-owned cleanup, not a universal asynchronous endpoint cancellation contract.
- The embedded example awaits settlement before rollback/return/finally disposal and teaches native .set writes. No public API or activation change is introduced.

## Tests and qualification limits

The two decision cases assert real endpoint delivery and hasPending before invoking confirm/reject, then repeat the literal and check no-write/nonduplication. They also preserve final local route/note state checks. A permanently held note fails by test timeout rather than passing without work. Teardown checks dispose-before-destroy, idempotence, no late status/delivery change and late-call guards. Label and lazy-route checks are useful source/UI controls.

A gap worth closing in the same app spec, without a campaign: no test currently injects declare() throw or settled() rejection. Source catch/finally is correct on inspection, but the claimed promise-error handling is not directly discriminated. A small mocked rejection test can await publishIndependentNote(), assert the error is shown and publishing resets while the proposal stays pending. Do not pretend this mocks or proves endpoint send-failure reporting; settled can resolve after an endpoint error under the library contract.

Spec invokes publish via the class while propose/decide use DOM clicks. Planned browser qualification should exercise the publish button itself, route navigation, pending delivery and leaving the page. No new library suite is needed for this apps-only delta. Existing parse checks do not qualify Angular template types, Jest mock types, SCSS, production budget or actual rendering. The app production build/browser checks remain pending with Noether; the lazy route does not by itself prove zero initial-bundle growth or budget compliance.

Proceed with Main's bounded composition after the wording correction, then the already planned apps-only checks. No new architecture review, broader demonstration or UI feature is proposed.
