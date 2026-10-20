# Independent review of causal repair plan

Reviewed /private/tmp/link-causal-plan.md against helper87231fb2, native patchfa397, approved experimental proposal, and preserved qualification. Read-only; no new runtime tests or patches.

## Supported claims

The plan accurately separates entity projection/address loss, native entity adoption coverage, operation status/error lifecycle, and resource retirement. Calling projection identity and lifecycle organizing contracts is reasonable; claiming they are one already-proven abstraction would not be. The draft does not make that stronger claim. Existing native source/field projection and paired-installation seams are plausible inputs, not evidence of a complete repair.

It preserves the decisive supported-carrier failure: entity scalar9 becomes undefined. It does not excuse that as unsupported aggregate use. Source guarding remains separate. It also correctly treats two secondary-error assertions as one missing reporter cause, receipt terminality as observability failure, and retained-map growth separately from unmeasured held-receipt tree retention.

The ownership table correctly separates user receipt lifetime from delivery acknowledgment. A started receipt can compact immediately while the delivery obligation still owns its payload until completion. Live authentic handles require compact irreversible outcome identity; dropping per-operation leases must not make terminal handle reuse unauthentic or silently confirmed. No new public token is implied.

## Preimplementation clarifications needed

1. **Source validation and user-code horizon ordering.** The plan should expressly open the conservative operation horizon before any user-controlled declaration input access/iteration and keep it through callback return-shape validation and secondary-error reporting. Native source classification itself should use trusted metadata without calling arbitrary source methods/getters. Validate unsupported category/disposed connection before work callback, while preserving effects of any reentrant input-validation code conservatively. “Validate supported source before invoking work” alone does not specify these earlier reentry boundaries.
2. **Stale source versus destroyed tree.** Retired entity references must not retarget replacements, but the existing contract does not automatically require the declaration wrapper to throw before callback for every absent/dormant source. Distinguish supported source category, current lifetime availability, and disposed connection. Preserve existing native semantics for held references/no-op writes and separately prove no publication authority attaches to a replacement. If the intended repair chooses a new stale-source throw policy, that is a semantic decision needing explicit justification/authority. Tree.destroy must not be silently equated with connection.dispose.
3. **Reporting failure cannot finalize early.** Preserve the original callback error while reporting its secondary declaration failure exactly once. A reporting callback's reentry must remain within the relevant horizon; a reporting callback throw must not skip frame invalidation/cleanup or overwrite the primary. Reporting the same failure again is not a cleanup strategy. This is implied by the acceptance list, but state it in the transition contract as well.
4. **Frame retirement is not just stack pop.** A returned child receipt still depends on unfinished parent validation. Conversely, once the horizon is complete, immutable proof may retain needed dependency identities without retaining all parent frames. The earlier leak and current retention failure show why these are two distinct transitions. The table's transfer/release wording is correct; require its implementation diagram to identify the exact owner of remaining dependency leases.

## Remaining boundaries

No new unresolved product question is established for correcting existing payload, secondary-reporting or terminality behavior. Unknown hidden inputs remain application responsibility; a repair cannot make complete-declaration validation stronger by assertion. Stale-source policy becomes a product question only if a new throw/no-write behavior is introduced rather than existing native semantics preserved.

The plan's no-permanent-mirror/no-new-authority constraint matters for entity adoption: ordinary-before storage should be justified by inspection divergence or live capture/recovery obligations, not retain a permanent duplicate of every entity row. Whether existing entity seams can do this is still experimental. Failure there should trigger the stated architectural stop, not exemption from the constraint.

## Disposition

Suitable as a bounded preimplementation plan after the ordering/stale-source clarifications. It does not establish that the common descriptors or lifecycle are sufficient, and it does not justify production integration yet. Preserve separate gates and first failures; do not combine all remaining issues into one apparent passing status after only one component is repaired.
