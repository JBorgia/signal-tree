# Link input-boundary contract comparison

[Specification comparison](SPEC.md) and [independent review](REVIEW.md), based on
`2b1e80e8912fc9321af0d97818c1014317da4d84`. No implementation or new executed
acceptance result. Production hold and the automatic-progress blocker remain.

The [exact previous pair](../link-immediate-independence/README.md) is reused:
literal y(7) and reactive y(x()) receive identical responsibility facts while x's
owner remains pending. The closed owner-window mechanism is not expanded.

Tracked execution can distinguish fresh intercepted reads from literals, but cannot
certify completeness for an arbitrary closure, a value read before scope entry, or
a cached native computation. Those inputs need evidence, an application completeness
assertion, or conservative holding. Explicit ownership supplies that assertion more
visibly; a false declaration can leak speculation. Neither is automatic proof for
unobserved inputs. Publication dependencies do not assign rollback ownership.

The specification covers the pre-scope saved value, trigger dependencies, nested
and async work, throws, multiple owners, overwrite/ABA, cross-runtime limits and
unchanged delivery/disposal constraints. Rejected held-receipt lifecycle remains a
future concrete design obligation; no new veto on surviving ordinary truth is approved.

Recommendation: if application completeness responsibility is acceptable, explicit
publication ownership is the clearer starting contract. Tracking could reduce work
for supported reads but cannot erase the hidden-input obligation. Otherwise return
the conservative automatic-scope choice to the owner. Neither direction is selected;
API notation is illustrative, not an export or implementation plan.

The previous [policy specification](../link-policy-comparison/SPEC.md) and
[application-shaped adoption evidence](../workflow-adoption/README.md) are reused.
No new code-length counts, runtime comparisons or four-framework qualification are
claimed. No ceiling changes, B work, release or production activation.
