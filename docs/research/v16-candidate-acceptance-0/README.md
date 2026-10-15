# V16 candidate acceptance verification

Owner approved the recommended ceilings with “proceed with recommendations”
after the reduction audit and explicit proposal. This supersedes the earlier
budget refusal; it does not authorize publication, merging or performance
neutrality claims.

Runtime baseline for this verification: `4742ecbcf8af8e225a618ce6555d04dc35b216f4`;
evidence-only predecessor: `8342ec6b632169540cc0f76b4a0c6176d134a262`.

| Artifact | Measured | Approved ceiling |
| --- | ---: | ---: |
| Bare production gzip | 11.64 KiB | 11.75 KiB |
| Bare development gzip | 13.99 KiB | 14.10 KiB |
| Entity production gzip | 25.46 KiB | 25.60 KiB |
| Entity development gzip | 28.22 KiB | 28.40 KiB |
| Demo initial | 563.16 kB | 570 kB |

Measurements and exact commands are preserved in
[optional structural preparation](../optional-structural-preparation-0/README.md).
The demo warning ceiling remains 525 kB: only its error ceiling was approved.

The accepted cost supports responsibility capture, retained settlement authority,
coherent publication and preservation of callback-authored writes. It is not
attributed entirely to the latest patch: the older baseline already exceeded
previous ceilings. The reduction audit removed unused structural code and moved
optional target planners outside ordinary EntityMap output. Both planner splits
save 823 gzip bytes in the matched plain fixture; enhanced fixtures have their
own recorded costs. No semantics, diagnostics or assertions were removed to
obtain green. Required shared machinery remains a real production cost.

Next: freeze this budget-only candidate, complete the registry and mutation
proofs, rebuild after mutations, verify packed strict consumers and Angular AOT,
re-run semantic characterization, and assess complete-candidate runtime cost
against the original baseline. Preserve every first failure. Passing the new
size limits is owner cost acceptance, not correctness or release acceptance.

No release is authorized by this record. V14 and new architecture remain out of
scope. Earlier records retain their contemporaneous failed budgets and decisions.
