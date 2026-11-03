# Independent executable-model challenge

Read SPEC.md, model.mjs, model.test.mjs and model-first.log from `/private/tmp/link-provenance-feasibility`. No edits to model/tests/repository. The supplied first log records 15 ordinary passes; I did not rerun that suite. I executed three additional read-only node stdin witnesses against the exact supplied model. Trusted input is accepted as hypothetical authority; its absence from production is not a model defect.

## Blocking bounded-model finding: nested frames lose dependencies in both directions

`frame` creates a new set exclusively from the supplied dependencies and pops it without joining child observations back into the caller (model.mjs:14-17). `write` reads only the top frame (30-35). `deliver` forwards the callback's return value (38). Consequently ordinary synchronous callback nesting can move pending values across frames and mark them eligible. This does not require an async callback, native framework cache, or misuse of trusted input.

Witness 1, pending p on x=7 and pending q on b=3:

```js
m.deliver(x, v => m.deliver(b, () => m.write('nestedCopy', v)));
m.settle(q, 'confirmed');
```

Executed output: `{"case":"outer captured argument in nested callback","value":7,"eligible":true,"p":"pending","q":"confirmed"}`.

The nested callback received v through its closure from the active outer callback. It carries only q, so confirmation of unrelated q releases a copy of still-pending p. This violates the stipulated synchronous-copy hold.

Witness 2, pending r on a=7, independent clean=0:

```js
n.deliver(clean, () => {
  const copied = n.deliver(a, v => v);
  n.write('returnedCopy', copied);
});
```

Executed output: `{"case":"nested callback return","value":7,"eligible":true,"r":"pending"}`.

The nested callback's known dependency is lost when its return is consumed in the outer frame. A callback writing a captured local instead of returning a value gives the same result. Executed output for that variant: `{"case":"synchronous captured local from nested callback","value":7,"eligible":true,"s":"pending"}`.

The existing nested test (model.test.mjs:43-49) writes constants in separate frames, confirms p first and checks q remains. It does not test outer→inner value transfer, inner→outer transfer, or confirming q first. Therefore its pass cannot support general nested causal correctness. A corrective policy must explicitly define inheritance and propagation between nested frames, including throw paths. Conservatively restoring exactly the old outer frame is insufficient when the child can have changed a captured local before throwing.

## Other interpretation limits and missing falsifiers

- **Cached reads:** No native or model computed cache exists. `read` explicitly unions labels, so its test cannot establish tracking through a native cache hit. A cache object outside `values` is uninstrumented and has no provenance carrier. SPEC correctly excludes universal dataflow and requires a separate native investigation; keep this row unproven. The synchronous nested-local witness demonstrates that caching outside tracked locations is not exclusively an async limitation.
- **Equal/no-op writes:** The model always installs a revision and label even for equal values (33-35), and its frozen case explicitly chooses that semantics. This is a coherent model policy, not confirmation that production no-op setters install publication responsibility. There is no comparator, notification suppression, retained endpoint-known value or overwrite-conflict machinery in the model. Production parity requires a separate hook/contract showing when an equal attempted write becomes a new installed provenance revision. Do not report existing kernel no-op behavior passed.
- **Discard:** The simple rejected-copy test is substantive and correctly does not cleanse taint. It covers a token outcome, not rollback execution. There are no compensating writes, refused rollback, newly opened scope during settlement, deferred compensation delivery or settlement observer exceptions. Confirmation of q in witness 1 already leaks p; rejecting p instead of leaving it pending would still leave the leaked record eligible because p was never retained. A durable rejection rule cannot repair missing dependency capture.
- **Nested transaction ownership:** `owner` is supplied directly to each write and there is no transaction stack. The model can demonstrate union of explicit tokens, but not correct discovery/inheritance of the actual owner during nested transaction callbacks or cross-tree ownership checks. This is a bounded-model omission, not evidence production is defective.
- **Reclamation:** reachableObligations enumerates model value/queue/frame roots; it does not reclaim tokens or inspect JS references. The reclamation test still retains `p` and `x` local variables after the reported count reaches zero (test:72-75), and an old record can later be passed to deliver again. The result supports only “no model-owned root references this obligation,” not token garbage collection or last actual reference. SPEC's wording “last model reference” must mean roots enumerated by this diagnostic, not all reachable JS values. Queued closures can also retain records beyond their explicit `record` field. Destroy clears values/queue only, leaves active frames, has no terminal flag and permits writes afterward; teardown during callback is not covered.
- **Endpoint admission:** Rechecking after a callback is a meaningful local falsifier. It does not model queued sends, actual payload projections, Link disposal, acknowledgement, observation participation or callbacks that reopen a scope. Restrict interpretation to model latest-value eligibility immediately before endpoint call.

## Disposition

The 15-pass log is real supplied evidence for those assertions. It does not establish even the claimed synchronous nested provenance boundary: the additional executions produce concrete false independence. Preserve these first witnesses, add explicit nested data-transfer/error controls if revising the experiment, and retain the preregistered cases/results as history. No conclusion about production runtime correctness or an integrated architecture follows; production remains unchanged and the actual-kernel probe is independent.
