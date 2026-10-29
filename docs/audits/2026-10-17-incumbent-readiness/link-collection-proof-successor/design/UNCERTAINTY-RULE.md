# Distinguish unavailable inputs from closed historical windows

2026-10-29. Private representation correction requested by revision2 premise review; no public policy change.

The boolean unknown is insufficient to drive new authorship-window acquisition. A native support certificate must preserve WHY it is uncertain, independently of whether a required owner is still pending.

Use source-issued uncertainty provenance, retained in immutable fact references and combined without erasure:

- `unavailable-input`: this exact physical input has no trustworthy native authorship evidence (inspection view or uninstrumented origin). A new operation that actually consumes it captures the current possible-owner set at its own authorship before install, even inside an otherwise complete declaration.
- `captured-window`: this fact already acquired its finite possible-owner window. New consumers inherit that window; they do not rebase it against later pending owners.
- `closed-window`: equivalent compact form only when a captured-window component is wholly terminal and has no actual/validation role requiring identity. It remains unknown for declaration permission and permits the existing fresh surviving path; it never reacquires a window merely because a later owner exists.
- validation uncertainty/invalidity remains its own horizon information. Do not collapse pending/rejected actual input or invalid validation into a window-only certificate.

Selecting a contributor transports its provenance; it is not itself native input consumption. Recipient baseline uncertainty is likewise not source evidence. The same fact may combine unavailable evidence with an already-captured window: the new operation captures only for newly unavailable inputs, while inherited windows remain unchanged.

Discriminators required before implementation acceptance:

U1: unavailable inspection99 consumed while p pending => capture p and hold; p settlement wakes fresh surviving delivery; later r does not extend that captured window.
U2: removal with W(q), then q settles, then r opens, then supplied native consumer => conservative unknown with historical window, useful surviving delivery without W(r).
U3: aggregate input combines U1 and U2 => new current window justified by U1, never erased by U2; role identity overlap does not normalize it away.
U4: merely selecting untouched unavailable contributor holds aggregate but cannot create a false declaration-input contradiction.
U5: supported equal-value proof/uncertainty change completes and wakes without forcing a user value event.
U6: captured pre-compaction input has unchanged behavior after source compacts its current certificate.

A plain `unknown:true, owners:[], possible:[]` replacement is prohibited: it is indistinguishable from unavailableInput in the frozen source and would break either U1 or U2. This is a required private certificate distinction under two already-approved behaviors, not a new hidden-input promise.
