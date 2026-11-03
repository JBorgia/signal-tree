# Bounded hidden-collection interpretation

Disposition: concrete compatibility regression in the supplied differential; source supports a selected-route target-resolution/admission gap. This is not evidence that a hidden row's semantic lifetime expired. No repair is authorized or implemented by this review.

## Identity and evidence

Compared frozen predecessor 057c6b8f4933eca5dbb3c0c31c069612264998b66e71c9e49ddd1a933edddad3 (/private/tmp/st-native-explicit-handoff-successor/candidate) against c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db (/private/tmp/st-prepared-paired-successor/candidate). These are supplied manifest identities, not Git commits. Relevant individual file hashes are in IDENTITIES.json; the Vue fixture is byte-identical. Root HEAD is 628d302dadb082a48c58528651c9088234d0a777; unrelated root dirty files were preserved. Relevant source diffs are saved alongside this report. The retained 87f source was not changed or independently requalified here.

RAW-CASE.json preserves the exact case extracted from both /private/tmp/st-native-broad-differential/{predecessor,successor}/vue/vitest.json, with raw file hashes. Predecessor passes; successor fails at absent-collection.spec.ts:393, pending.rollback(), with “Missing live leaf for owner 5 [effect-validation-failed]”. The recorded broad invocation was corepack pnpm nx test vue --skip-nx-cache --reporter=json --outputFile=<respective raw path> --maxWorkers=2. This review read those existing results; it did not execute that command or an isolated replay.

## Finding: display-based indexing loses a retained compensation target

All line references below are to c47b unless stated otherwise.

packages/vue/src/lib/absent-collection.spec.ts:374–404 creates a collection row, transacts n=5, then omits its enclosing branch through a separate root whole-value write. It subsequently rolls back the pending row update while a synchronous Vue effect reads the retained row handle. The required behavior is successful compensation with all observed reads remaining undefined. The fixture does not require zero effect executions, and does not independently assert the hidden physical n after compensation. The observed failure is refusal before those assertions, not demonstrated disclosure of a hidden value.

packages/kernel/src/enhancers/transactions/transactions.ts:3779–3799 adds selected-operation admission before the incumbent realization route. tree-realization-adapter.ts:701–713 admits by the complete compensation's effect/order/frontier/structural shape. A pending field compensation can have no structural effect even when a separate later operation has hidden its enclosing collection. Thus excluding structural operations is not equivalent to excluding targets under omitted members.

In tree-realization-adapter.ts:719 the selected preparer constructs a fresh indexPointOwnerPaths(tree.$, effects). At :2422–2462 that lookup rejects a non-enumerable address component and falls back to indexStructuralOwnerPaths(root). That fallback uses visitTree; visit-tree.ts:76 enumerates Object.keys. Omission makes the branch non-enumerable while retaining its node (member-membership.ts:708–735, especially :724). Both fresh lookup paths therefore omit this hidden owner.

By contrast, createTreeRealizationAdapter at tree-realization-adapter.ts:465–474 captures its structural owner index when the adapter is created; the predecessor's incumbent apply path uses that retained index. The added selected route rebuilds an index at compensation time. Calling the fallback “incumbent traversal” does not preserve the incumbent index's lifetime: the same traversal at a later visibility state yields a different owner set.

At tree-realization-adapter.ts:2499–2511, resolveCurrentSubjectTarget resolves an inline field through structuralOwnerPaths.nodes.get(effect.owner). An absent index entry returns undefined before collection subject lookup. applyEffect at :1895–1914 then emits the exact missing-live-leaf message. That error conflates failed route lookup with semantic target absence; it does not establish destruction or replacement of the row lifetime.

The physical-rows.ts contract explicitly permits rollback/reversal to reach retained rows under omission through the collection's own row API, while public reads remain absent. Transactions opens that physical window and the exposed-publication gate around compensation (:3749–3758). Those windows do not make omitted properties enumerable. The distinction already exists in source; preserving it requires no new public availability policy. Internal Vue writable cells are callable and support .set, so this evidence does not establish a Vue carrier-shape or native-cache defect.

## Confidence and falsifier

Observed: the unchanged public fixture changes from pass to refusal in the supplied Nx results. Inspected: the route insertion, index timing/enumerability difference, and exact error-producing resolution path. Not independently observed: the runtime effect description, selected-branch entry, or owner-map contents in this exact failing run. The source chain is a concrete causal explanation, not a substitute for the author's isolated branch trace.

Cheapest remaining causal falsifier for that isolated replay: record whether selected admission is taken, effect owner/subject/field, the omitted ancestor descriptor's enumerability, and whether the fresh point/fallback index versus retained adapter index contains owner 5. Check the active subject identity separately from public row() availability. A non-selected branch or an owner present in the selected index would falsify this specific explanation. This instrumentation/replay was not run here; Carver's isolated replay remains separate evidence.

No bypass, additional guard, visibility change, or new repair was implemented or approved. Scope is one pending field rollback into an independently hidden collection, not all membership or structural routes. Prior bounded point controls and the separately accepted forwarding-edge cleanup do not qualify this c47b integration behavior. The cleanup's retention result remains a distinct, narrow improvement.
