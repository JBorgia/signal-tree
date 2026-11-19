# Native adapter construction boundary (before implementation)
Owner decision copied in OWNER-DECISION.md; bounded v16 only.
Any supplied existing native factory (createWritableCell, createWritableProjection,
createReadonlyCell) requires a callable createCurrentReadonlyCell at factory binding,
before state traversal, token creation, initialization, or mutations.
All three existing factories still select native runtime, exactly as before.
Partial native configurations with the capability retain their former portable
runtime selection; without it they reject, rather than silently changing runtime.
Token-only/neutral adapters with none of those three remain valid without the new
capability. Providing only the new capability does not select native runtime.
Presence of the capability is not a semantic probe: construction does not call it.
Validate SDK factory binding through internal factory binding (before allocation).
Stable v15 and production checkout are not edited.
