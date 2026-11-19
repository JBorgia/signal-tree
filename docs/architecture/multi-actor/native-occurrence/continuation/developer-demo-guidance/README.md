# I8 public demo guidance overlay

Prepared for Main independent review; not composed into the active candidate. This closes the requested public-demo gap without changing the SDK or adding an actor/remote protocol. Cost-attribution work is unchanged; no optimization was implemented.

## User-visible result

One lazy route, `/independent-publication`, appears in the existing Examples navigation group as “Independent publication · v16 preview”. The page and route metadata explicitly say **v16 development preview (unreleased)**; the introduction says it is not stable v15 guidance.

The tutorial starts with behavior: propose west, leave that proposal pending, publish the independently authored `dispatch-ready` literal through a Link on the owned note leaf, then confirm or reject the route locally. Three panels keep visible tree state, admission snapshot and actual in-memory endpoint deliveries distinct. Repeating the literal demonstrates `no-write` without another delivery. The UI labels local decisions and makes no backend durability, distributed agreement or performance claim.

A short warning explains that saved/hidden inputs and cached computations can still depend on a proposal even when their reads occur outside the declaration callback. Independent is correct only for the actual independently authored literal; dependent work needs all contributing owners, otherwise use unknown. The small, keyboard-focusable code example contains the public Angular facade import, `.set` writes, transaction, declaration, receipt read, Link settlement and explicit disposal/tree destruction. No private types or internals appear in the tutorial.

## Changed files

All paths below are relative to the candidate root.

| File | Rationale |
| --- | --- |
| `apps/demo/src/app/app.routes.ts` | One `loadComponent` route and preview metadata; no new static page/SDK imports. |
| `apps/demo/src/app/components/navigation/navigation.component.ts` | One entry beside the existing Server updates example; no new navigation section. |
| `apps/demo/src/app/components/navigation/navigation.component.spec.ts` | Add the route to the existing exact hierarchy expectation, retaining its other assertions. |
| `apps/demo/src/app/pages/independent-publication/independent-publication.component.ts` | Angular standalone OnPush page, native signals, public facade types, owned note Link, explicit receipt snapshot sampling and lifecycle cleanup. |
| `apps/demo/src/app/pages/independent-publication/independent-publication.component.html` | Behavior-first controls, distinct evidence panels, unreleased label, dependency warning and adopter code. |
| `apps/demo/src/app/pages/independent-publication/independent-publication.component.scss` | Existing layout-frame/design tokens, responsive cards, focus indicators, wrapping controls and scrollable code. |
| `apps/demo/src/app/pages/independent-publication/independent-publication.component.spec.ts` | Focused pending-delivery, no-write, local-decision, teardown, guidance and lazy-route assertions. |

There are three modified existing files and four new files. `before/` preserves the three originals. `overlay/` contains the seven resulting files; `demo-guidance.patch` is a root-relative unified patch. No deletion, package, configuration, budget or production-library edit is included. Existing already-optional diagnostic sites and the separate lint correction are untouched.

## Behavior and lifetime decisions

The runtime follows the approved installed `tools/experiments/multi-actor-operations/installed/reference.component.ts` and its `angular-runtime.mjs` control. This tutorial narrows the state to route/note; external capacity ingestion is omitted to keep the requested single interaction. The pending transaction is retained independently of the note publication. Local rollback restores the previous route (north on the first fresh proposal), not the independently authored note. A proposal after a prior confirmation can restore west; the tutorial now states this explicitly.

The endpoint appends only when its `set` callback runs. UI signals hold presentation state; they are not a second tree-state authority. A receipt is not reactive: the page samples `receipt.read()` immediately after declaration and after this action settles. It labels the value as a snapshot rather than implying a live receipt signal. Endpoint delivery is displayed separately and no network work occurs.

Publication controls disable duplicate in-flight actions and local decisions during settlement. Errors surface in a role=alert message. Destruction marks the component inactive, disposes the Link first, then destroys the owned tree. Await continuations do not update UI state after destruction. Late UI-method calls do no new work. The lifetime guard is component ownership, not a new library lifecycle mechanism.

The lazy route uses the project's existing dynamic-import pattern. Its page imports only Angular core and `@signal-tree/angular`. The navigation imports no page class. The plain code block follows existing page usage and avoids adding a syntax-highlighter or other dependency. This establishes lazy source structure; actual chunk sizes/initial budget still require the later production build.

## Focused tests prepared, not executed

The new spec uses the demo's existing Angular TestBed/Jest pattern:

1. Two decision cases (`confirm`, `reject`) click the proposal control, await note publication **before settling the proposal**, assert route is west, proposal remains pending, receipt is started and endpoint contains exactly one literal. If publication waits for the proposal, the test times out instead of settling it to manufacture success. A repeated declaration must return no-write and keep one delivery. Then the corresponding decision control is clicked and the correct route plus surviving note are asserted.
2. Destroy during an in-flight publication; call-through spies verify dispose precedes destroy and each runs once, and the public `tree.destroyed()` signal is true. After the pending action finishes, delivered/admission snapshots remain unchanged. Late methods and repeated teardown cause no new work.
3. One mocked `settled()` rejection injects an Error sentinel into the UI catch/finally path. The test asserts the displayed error, `publishing=false`, the still-pending proposal, enabled local-decision controls, and successful rejection through the UI. This is explicitly a UI result-handling test, not proof that a real Link endpoint failure rejects `settled()` or prevents delivery.
4. Rendered guidance separates preview/stable support, receipt/endpoint and cached input/durability boundaries. The route has `loadComponent` and no eager `component`.

The existing exact navigation assertion is updated because its list intentionally enumerates every destination. No assertion was weakened.

## Cheap verification actually performed

- Parsed all five resulting TypeScript files and the embedded adopter code with the selected TypeScript parser.
- Parsed the Angular template with the selected Angular compiler's `parseTemplate` only (no component execution/AOT/typecheck).
- Verified the page imports only Angular core/public facade and the routes file retains only its existing static Angular router import, with one dynamic page import.
- Formatted only the four new page files using the locally installed Prettier.
- `git -C /private/tmp/st-v16-demo-guidance/before apply --check /private/tmp/st-v16-demo-guidance/demo-guidance.patch` passed.
- Reviewed the finite patch and retained per-file before/after hashes; relevant candidate files remain byte-identical to the preserved originals.

No tests, lint, typecheck, style compilation, AOT, production build, browser interaction or rendered screenshot was run. No runtime or visual pass is claimed. Noether retains the heavy slot.

## Main review and later qualification

Review the patch against the current candidate before composition; verify the three before hashes and absence of the four new paths. Then use the existing demo Nx/Jest target for the page and navigation specs, followed by the existing affected lint/docs checks and required production demo build in the heavy owner's schedule. One focused command to adapt to that schedule is:

```sh
pnpm nx test demo --runInBand --skip-nx-cache --testPathPatterns='independent-publication.component.spec.ts|navigation.component.spec.ts'
```

The demo target has its existing `generate-deep-typing-proofs` dependency; this command was not launched. Do not skip necessary repository validation to claim sign-off. Main should additionally inspect the rendered responsive page and verify lazy loading during its later UI/build qualification. No new gate, timing campaign or configuration change is proposed.

Deliverables: `demo-guidance.patch`, `overlay/`, `before/`, `HASHES.json`, `CHECKS.txt`, `prepare.py`, `check.cjs` and this report, all under `/private/tmp/st-v16-demo-guidance`.

Main-requested review corrections: previous-route wording and one bounded mocked settlement-rejection UI test are included. `INDEPENDENT-REVIEW.md` remains the original review record. The separate `PLAYWRIGHT-RECIPE.md` remains proposed/unexecuted and explicitly starts with a fresh page; its north-after-rejection assertion applies only to that fresh session. Seven patch files remain unchanged in scope.
