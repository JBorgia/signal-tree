# C27 composition and remaining retention boundary

C27 composes the reviewed scalar C26 repair with the approved existing-source
public declaration surface. It is a bounded candidate, not an integrated runtime
or release candidate. Retained production remains `87f6831f`; B remains closed.

Exact C27 source manifest SHA-256:
`bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd`.
C26 manifest:
`8055911bdd78c9df536bc8a7e1ea8bf3e74427c64675fbc8d0a566c0d91aa38f`.

## Current evidence

- [Composition](c27-public-composition/): three clean patches; 54 tests in eight
  files, source/public/spec types pass. No manual runtime conflict resolution.
  [Main verification](c27-main-composition-review/) checks source identities and
  unchanged emitted implementation JavaScript for the two compared files.
- [Historical failure reconciliation](c27-remaining-failure-ledger/) separates
  obsolete expectations, harness defects and incomplete large-case verification.
  [Current replay](c27-remaining-failure-replay/REPORT.md): nine unchanged files,
  59 tests pass on C27. This excludes GC and the large 130,000-row cases.
- [Entity source checks](c27-source-coverage/): three added public scenarios pass
  and spec-types pass. They cover row rollback/delivery, collection release after
  a foreign rejection, and reentrant field delivery. Counts are not an assertion
  of complete entity qualification.
- [Row receipt adjudication](c27-row-receipt-adjudication/REVIEW.md): the preserved
  ROW23 assertion expects the earlier declaration to start when the later rollback
  revision sends. Existing revision-scoped receipt semantics instead support
  superseded for that earlier declaration. Original assertion/failure retained;
  this is not permission to accept arbitrary receipt outcomes.

These test groups are not summed into a unique full-suite total. C27 has not
received fresh package, broad-suite, GC, cost or release qualification.

## Remaining retention boundary

[Independent owner-history trace](c27-owner-history/) and
[Main C27 replay](c27-owner-history-main/REPORT.md) show actual owner identities
1/2/3/5 after 0/1/2/4 distinct confirmed inputs, while one owner remains pending.
All five remain after confirmation. Useful delivery, rollback and value-notification
controls pass. This is selected graph evidence, not heap bytes or universal GC.
The C26 fixed-owner ancestry improvement remains valid.

[Current-certificate design](c28-current-certificate-design/) and its
[independent premise review](c28-current-certificate-premise/) consider retiring
historical confirmed input/validation evidence at a new admission. Old issued
snapshots, captures, retirement authority and fresh authenticated-handle validation
must remain intact. No C28 runtime is implemented or accepted.

The [public A/B discriminator](c28-no-write-discriminator/REVIEW.md) now establishes
an observable distinction, not merely an internal equality difference. Both arms
have identical current values, pending ownership, fresh updater input and exact
one endpoint delivery. Different prior confirmed input histories produce:

| Arm | Fresh receipt after drain | After pending owner confirms |
| --- | --- | --- |
| A | no-write | old receipt started; fresh stays no-write |
| B | conservative | old receipt superseded; fresh started |

Two observation tests pass; they assert matched premises, not a desired receipt
oracle. This does not prove unlimited history is necessary or select a policy.
The [contract review](c28-no-write-contract-review/REVIEW.md) distinguishes current
observable behavior from an explicitly required historical-identity promise.
[Independent interpretation](c28-no-write-contract-review/AB-ADDENDUM.md) and
[design options](c28-current-certificate-design/OPTIONS.md) are complete. Main
independently replayed both tests; all 20 observation records match exactly.

Owner [approved the bounded direction](C28-AUTHORITY.md): prospectively ignore obsolete already-confirmed
input/validation history for no-write when current ownership, publication
obligations and validation are unchanged. The recommendation would make both
fresh A/B declarations no-write, leaving the earlier receipt to represent the
send. Fresh validation, pending/rejected evidence, issued captures, terminal
receipts, retirement classification and meaningful equal-write evidence refresh
must remain intact. This is an authorized observable semantic clarification, not a proven
implementation. The original historical distinction remains preserved as evidence.
A bounded C28 implementation and qualification may proceed; activation, release
and budget changes remain unauthorized.

## Next gates

1. Resolve receipt relevance and current-versus-issued evidence for bounded
   retention; preserve the public discriminator and fresh handle validation.
2. Qualify a reviewed mechanism against aliases, reentry, retirement, destruction
   and entity paths before general integration.
3. Complete remaining large restoration/GC, broad regression/mutation, fresh
   artifacts and representative costs. Previous budget failures are not erased;
   no new C27 measurements or ceiling changes are claimed.
4. Update consumer guidance/demo and run exact-candidate release gates only after
   correctness and retention qualify. No activation or release is authorized here.
