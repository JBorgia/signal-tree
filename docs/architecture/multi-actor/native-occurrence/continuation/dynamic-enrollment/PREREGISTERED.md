# Dynamic-member gates before runtime edits

Baseline frozen C0; exact manifest in COPY-VERIFIED.json and SOURCE-SHA256.json. No public API changes, no late physical projection, no registration during speculative preparation.

1. Unchanged whole-value-new-keys.spec.ts: preserve both Link timeouts, later child update, and earlier completed member when later value throws.
2. Existing root/nested/sibling recipients see new ordinary subtree then later leaf edits; inspection new subtree remains absent until explicit ordinary whole-member adoption, without leaking inspected siblings.
3. prepareMembership participant throws after dynamic recipient preparation: no physical child, no preparer retained; retry produces one delivery and later edits work.
4. Reentrant membership preparation changes parent/new key: refuse stale prepared edge before install, preserve newer identity and useful subsequent writes.
5. Foreign pending owner holds new member; rejection releases surviving ordinary write. Disposal while pending does not resurrect recipient or obstruct settlement.
6. Omit/readd reuses retained lifetime; repeat edits deliver once; callback sees complete enrollment and can author a new descendant value.
7. Inventory actual materializer collection producer independently; ordinaryConstructionValue rejects markers. No scalar-to-collection qualification inference.
8. Source types, spec-types, focused membership/occurrence and failure suites; no broad run until known reds explained. Preserve every first output and source identity.
