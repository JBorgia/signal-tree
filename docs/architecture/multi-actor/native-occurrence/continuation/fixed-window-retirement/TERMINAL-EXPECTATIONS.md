# Terminal expectation disposition

All three supplied retirement fixture files are archived byte-for-byte in originals/. All inherited tests remain unchanged; no assertion was weakened or removed.

The requested expectation revision applies only to source facts demonstrated to carry solely their own fixed window. Original `entity-negative-publication-retirement.spec.ts` already asserts this drain: its two cases remove a row after an independently authored foreign transaction. Both fail on C1 and pass with this patch. New own-W tests add exact classification, unchanged issued proof, queued (not inline) release and all-eight-map assertions.

The historical `publication-retirement-boundaries.spec.ts` foreign-confirm/rollback tests remove the row INSIDE the foreign transaction callback. Actual provenance is rawUnknown=true and retirementOwnWindowOnly=false; see provenance-foreign-callback.json. These are arbitrary source uncertainty, not the simple W-only cases. Their terminal retained-fact identity/count assertions remain valid under the owner-requested narrow rule and pass unchanged. Changing them merely because the possible cell terminated would broaden the cleanup rule incorrectly.

Thus the earlier review's conditional suggestion of terminal-only revisions is resolved by exact source evidence: new qualified terminal cases require drain; the existing differently authored cases retain proof. Originals and baseline failures remain preserved. No claim of an unchanged test becoming green by changing its workload or oracle.
