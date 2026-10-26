# Plain membership producer admission contract

Read-only source/design review of frozen f01ed39a7df8a5de185ebec0773e09e36537dacb in `/private/tmp/v16-transition-qualification`. No runtime, tests, models or probes executed/changed. No other new reviewer files read. This is source interpretation, not an executed counterexample.

## Producer ordering and partial success

`signal-tree.ts:965–1042`: recursiveUpdate prepares ordinary members, begins a structural-write group, and captures a membership before-image before applying supplied entries. A new member's child and responsibility are installed together, observation is inherited, then membership is invalidated immediately before a later user updater/equality can reenter. The public native membership frame remains owned by the surrounding group. If a prior updater already created the member, the outer write uses that escaped identity instead of replacing it with its stale prepared child.

`1241–1334`: whole values omit unsupplied members; partial outer updates omit nothing. Supplied descendants still use whole-value semantics. Re-add requires a supplied value actually installed; undefined/discarded values cannot resurrect retained storage. The readdedDuringStructuralWrite stamp protects a path re-added by a nested write from the outer omission pass. Reconciliation republishes only changed members. The finally block emits actual final membership even after a later sibling fails, preserves the earlier application error, and contains a second publication error. Consequently the complete outer operation is not an atomic all-or-nothing unit: successfully installed earlier units remain truth when a later sibling fails.

`internals/plain-branch-membership.ts:83–194`: before-images include supplied fresh keys as absent and existing potentially changed keys; closure metadata is captured at entry. At final publication descriptors and exposed after-images are read then. Only keys whose **presence differs** are emitted. Members contain literal keys, actual branch identity, current child position ids where available, before/after presence and exposed after-value. Undefined value tuple is intentionally unused, not an undefined assignment. A final event can summarize several installed units; it is not one-to-one with native installs.

## Held path re-add differs deliberately

`member-membership.ts:328–413`: the value is installed first; absent descendant writes reactivate the whole path, keep off-path dormant siblings absent, and retain identity. Capture precedes membership mutations. Announcements are innermost first and occur **before the writer's own value announcement**. The leaf's own token publishes once; branch wakeups are handled separately. This ordering is deliberate and documented as a prior reverted alternative; a handoff cannot standardize all membership announcements to after-values without changing load-bearing chronology.

## Existing asserted constraints

- `whole-value-membership.spec.ts` cases 5, 7, 16, 18 and 20: omission is not fabricated undefined write; descendant write reactivates; changed-value UNION changed-membership publishes a semantic slot once; supplied value, not dormant storage, returns; ordinary value write is not a membership transition.
- `owner-invalidation-membership.spec.ts:100–224`: membership-only, multi-member removal and mixed value/removal invalidate owner once; identical whole value does not invalidate; nested inner/outer writes preserve that grouping.
- `path-notifier-membership.spec.ts:14`: flushSync drains reentrant removal/re-add in order `[false,true]` and leaves no pending work. Cases at45 explicitly require value7, remove, value8, add, remove chronology while outbound Link may coalesce to final omitted profile. Cases around100 prohibit merging membership with adjacent value; case185 distinguishes different branches sharing diagnostic paths.
- `plain-branch-membership.spec.ts:106,180,212`: staged target installation completes before observation; staged preparation validates all targets before mutation; late after-image inside invalidation group uses actual supplied nested value, not stale memo. This staged route's atomic validation does not imply recursiveUpdate's later-sibling failure is atomic.

No examined assertion fixes a public notification count for arbitrary outer-add/nested-remove/re-add composition or a connection created inside an updater. Do not invent one. Existing grouping, absence, chronological barrier and identity constraints still govern these cases.

## Why final-event correlation alone is incomplete

A fresh member can be installed and exposed to a callback, a connection created to it, and a nested write can remove it before the outer finally. Outer captured before=false and final=false produces **no outer membership frame**. Likewise an existing member can be removed and re-added within an outer interval, returning to its initial presence, so the outer frame omits it. Nested frames may exist, but their metadata belongs to the nested write; they cannot substitute for the outer installed unit's attribution/dependencies. Even when an outer frame exists, its final child after-image may include nested writes that were not authored by its captured outer metadata.

Therefore a private admission-before-publication handoff cannot assume every installed unit will have one later public membership event, or assign the entire late after-image to one outer admission. It must distinguish installed-unit admission, native public summary, and per-relationship projected snapshot. This is an information/identity requirement, not permission to emit extra public notifications or create rollback ownership.

## Required private handoff invariants

1. Install evidence with each actual successful native membership unit and its own write context before any callback can observe/reenter. Failed/uninstalled prepared units contribute none. Preserve actual registry/member identity and a stable operation identity, not just branch path or current descriptor.
2. Preserve grouping and chronology: final membership remains presence-difference summary; held-path re-add stays innermost-first before value announcement; barriers and reentrant flush draining remain unchanged. Private evidence may survive a net-zero public summary without requiring synthetic public events.
3. Associate public summaries with the ordered installed units that actually contributed, including nested units and partial-success exits. A missing or net-zero outer frame cannot mean no operation occurred. Retire cancelled/superseded publication evidence by exact identity, not guessed value equality.
4. Connections created during callbacks observe their actual native creation baseline. They must not inherit a pre-creation payload, arbitrary prior receipt, or an outer admission's eligibility merely because their address later matches. Existing source identity plus commit/admission chronology must establish the association.
5. Capture late exposed values at the existing native boundary. Do not reinterpret whole-member after-images as proof every nested field was authored by the outer operation. Preserve inspection filtering, conservative hold, authoritative ingress and current eligible projection rules.
6. Keep publication dependencies separate from rollback responsibility. No added history turns, claims, pending owners or public API follow from admitting these units. Lifecycle release must cover units with no final public frame, exceptions, supersession and disposal.

Existing final events supply useful summaries and captured after-images, but are not a complete operation ledger. A design retaining installed-unit identities through group finalization can express these cases using existing mutation facts; a design that only joins receipts to the one eventual membership event cannot. This is the concrete boundary to close before runtime resumes. Later falsifiers should cover partial sibling failure, fresh add followed by nested removal/net-zero presence, nested re-add protected from outer omission, and a Link created in the intervening callback, without changing the existing notification assertions.
