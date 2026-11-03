# Independent enrollment review — blocked by reproduced equal-sibling regression

**One blocker demonstrated. Do not accept the frozen enrollment arm or C15 as qualified yet.** The six enrollment-progress cases and bounded safety composition pass, but an unchanged scalar frame test loses a pending changed projection when the final equal sibling changes support.

## Reviewed identities

- C12 base: `d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2` (3053 files).
- Anscombe enrollment freeze: `ae2d5bb7b2be7fe06cadc5bd09c1bba531ca9e305739ca2d06fad238cd5b4378` (3054 files), runtime patch `1636a26aa6257c248f416f98f120ebbda9c7d24069d24f9663c51362c9843fa2`.
- Scalar correction: `d0b54e145b88a38015b3176000e0a8c23b74ebdc33be6f8eab0c122f2fb4b812`, used only for own scratch composition.
- C15: `02aba88c81c413700ef4af2f9bf8facc422cabf01fddf6a31b4ec2d777b16568`, all manifest entries verified before copying. Its lifecycle.ts/private.ts bytes equal the independently composed pair in own `combined/`.

Own composition applies the frozen scalar runtime patch to the frozen enrollment arm and explicitly initializes `observeRevision` with `declared:false`. This is a recorded semantic merge, not a new fix. No author/frozen/root runtime or original assertion edits. Initial copy command attempted a not-yet-created working directory and failed before execution; retried from the existing scratch root. No source changes resulted from that setup error.

## Blocker: changed obligation lost behind equal support revision

Falsifier: unchanged `packages/kernel/src/lib/scalar-frame-publication.spec.ts:375-391`, “sibling prepared records retain changed contribution when final sibling is equal”. A private prepared scalar frame installs a=1, b=0 from {a:0,b:0}; the physical snapshot is correct but outgoing Link never receives {a:1,b:0}.

Own unchanged replays: C12 **passes**; enrollment arm **fails**; exact C15 **fails**, first assertion `sent.at(-1)` is undefined. The regression therefore exists without scalar-patch composition. C14's prior pass was reported by Main; this review does not claim a new C14 execution.

Pass-through traces on C12 and C15 establish:

1. A has native requirement, native proof unknown=false, no owners/possible cells, historicalWindow=true. B is an equal unscoped scalar; `private.ts:129` deliberately skips new native preparation. Its recipient operation has no native requirement.
2. Old C12 adds recipient unknown to A; B is also unknown. `sameProof` matches and B collapses with `noWrite`, preserving A's projected changed=true. Link reaches admission/allowed and sends.
3. Enrollment arm `lifecycle.ts:268-271` removes recipient-only unknown for native-backed A but conservatively retains it for no-native B. A is now unknown=false, B unknown=true. This is why proof equality changes; it is not a native dependency disappearing.
4. `private.ts:287-300` retains B as a meaningful support revision, supersedes A, and sets the new projected record to `changed:unit.changed`, which is false for B. The payload still includes A's changed value.
5. `link.ts:1047-1053` selects B's correct payload but does not set dirty for changed=false. The trace records **zero calls to admit or allowed** and no send. Thus the new `hasDeclaration` lookup is NOT the proximate cause of this witness. No delivery permission is even requested.

Contract violated: unchanged frame completion must preserve useful publication of an installed changed sibling when a later support-only/equal sibling reduces. The internal frame entry is deliberate test infrastructure, not an invented public adapter; its unchanged composition obligation cannot be waived by API scope.

Preserved evidence: `baseline-equal-sibling`, `independent-equal-sibling`, `c15-equal-sibling` raw commands/logs/exits. `baseline-equal-proof-trace-observations` and `c15-equal-proof-trace-observations` preserve native-presence and proof reduction comparisons. Diagnostic tests assert physical state and record routing; their green exit is not a safety/progress pass. Original failing test remains unchanged.

## Permission lifetime disposition and correction boundary

No separate permission-lifetime defect is demonstrated by this failing test. It fails before admission. Do not retain superseded lifecycle operations merely to make `hasDeclaration` true, copy A's declared permission to B, drop B's conservative unknown, or patch Link callers as a shortcut.

The bounded mechanism question exposed here is a pending **value-change obligation** across support-revision reduction. A current support-only revision must not erase earlier, still-undelivered value work in its selected aggregate payload. Any proposed correction must preserve that obligation while using the current selected support for admission. Value-work lifetime, recipient permission, and operation/dependency retirement are distinct. The current unknown B may still deliver via ordinary surviving admission when no actual obligations hold; no declaration permission needs to transfer.

Required discriminators for a proposed mechanism: original unchanged failure; reversed/equal-only frame; current support-only revision that adds pending native support must retain value work but hold until settlement; later author reentry cannot restore old payload or old permission; consumed value work must not duplicate endpoint sends. These are review requirements, not an implementation performed here. If a separate test reaches allowed/admit and proves permission expires incorrectly, analyze that exact send identity/lifetime independently; this witness supplies no authority for such a change.

## Enrollment/source-permission review

Source inspection confirms native-backed nonmatching recipients no longer manufacture a recipient-only window solely for lacking a declaration. No-native/unobserved-authorship/unknown-active-scope paths retain conservative treatment. Whole projected native and membership support still participates in readiness and eligibility. `declared` records only matching recipient scope; `private.decision` requires that permission for declared early admission. Nondeclaring recipients use surviving admission/grants. `allowed` is checked before `started` retires the operation (`link.ts:899-919`). Observed scalar facts initialize declared=false in composition and cannot inherit an ambient declaration permission.

Executed unchanged enrollment16 plus author controls9 and original recipient-window9: **26 pass / 8 fail**. All six formerly failing enrollment variants now pass. The eight new window failures need the premise-specific disposition in WINDOW-ADJUDICATION.md, not blanket dismissal. Original first failures are preserved.

Own composed replay: **61/61** across enrollment16, recipient-source-permission9, scalar native support10, original actual-contradiction1, real-native-window counterparts8, publication-evidence-scope controls, aggregate-native-input controls, and entity-native-input controls. Additional unchanged native-certificate scalar/membership parent invalidation: **2/2**. This verifies both progress and the known independent-arm safety leak after composition for these cases; it does not outweigh the equal-sibling blocker.

The independent enrollment arm does not contain the scalar-notification repair. Its known parent-invalid leak remains an explicit composition obligation; no oracle exemption or fresh independent-arm safety acceptance is asserted.

## Eight-window adjudication and retained coverage

See WINDOW-ADJUDICATION.md for all eight mapped to approved premises. Eight additive real-native possible-owner counterparts pass on C12, enrollment arm and composition; two preparer proof probes pass on both C12 and enrollment arm. No original window assertion was deleted or edited. The private later-preparer case is distinguished from public writes and its actual finalization-window coverage is preserved under unknown native scope.

## Validation limits

Combined source types and combined/independent spec types passed. Final C15 diagnostic spec types also passed, including the added equal-sibling trace. Pinned Node24.15.0/pnpm10.17.0, Nx kernel tests, no cache, maxWorkers=1, own copied sources/dependency symlink. Full raw commands and first failures are in this scratch. Archived audit tsconfig warnings were nonfatal and retained.

No full suites, cost campaigns, release activation, runtime corrective patch, permission redesign or oracle promotion. Equal-whole authority/design is a separate task and not used to reinterpret this scalar frame regression. Stop at the concrete blocker and require reviewed correction before further candidate acceptance.
