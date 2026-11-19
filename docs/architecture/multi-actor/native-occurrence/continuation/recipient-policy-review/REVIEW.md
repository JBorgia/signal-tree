# Independent recipient-window implementation review

**Bounded verdict:** no new implementation falsifier in the reviewed fixed-window/lifecycle controls, but **do not accept the candidate as contract-conformant**. A concrete overbroad admission condition holds two recipient-only cases that the inspected owner-selected policy explicitly exempts. See `CONTRACT-ADJUDICATION.md`; the known-input error expectation is separately correctable under the approved contradiction contract.

## Exact source and replay

Reviewed frozen successor manifest SHA-256 `f7138509c91316ab5b1cdc5d7bb9276d55637e8c88d3123b5e4d1596fc70fe55`, 2,968 files, runtime patch `8237ced7d92011d25dcaba1f1d03a3dfdeb11a90a8e595d8d093c52166c2f43b`. `IDENTITY.json` independently verifies every manifest entry before copying. Reviewed three runtime files: experimental-publication/lifecycle.ts, experimental-publication/private.ts, internals/intrinsic-mutation.ts. Author source and combined B were not edited. Own copies: `recipient/`, `known-input/`.

Fresh-copy author-selection replay reproduces **152 pass / 3 fail**, `replay.log`. The three failures are exactly the known-input throw and two wider fallback conflicts. Fresh-copy known-input replay reproduces **2 pass / 1 original fail**, `known-input-replay.log`.

Own runtime review controls: **9 pass**, `adversarial-final.log`. They cover scalar and branch equal unknown proofs while held; equal qualified writes with an undeclared held recipient under confirm/reject; exact native-input versus recipient-only uncertainty traces; membership omission under confirm/reject; and a finalizer throw proving no value, prepared-record, completion, or recipient-operation installation. Membership fixture typing was corrected to optional y; the same runtime assertions then pass again (`membership-final.log`). First type failure and original spec are retained; no assertion or runtime source was changed. Final spec-type result is in `spec-types-final.log`.

## Mechanism assessment

- `prepareRevision` snapshots incompleteness at preparation, captures the pending-owner window once in finalization and stores an immutable array of owner-cell identities. Normalization removes destination and actual-input owners only from this new window. `recipientProof` unions inherited possible evidence rather than subtracting it. `projectRevision` and horizon finish retain the binding-local window; they do not rescan pending owners at delivery.
- The fixed window is separate from source-native D/I/V and shared validation. Complete matching declarations do not acquire a new window merely from inherited native unknown. Missing matching declarations and explicit unknown contexts stay conservative. Author controls independently replay later-owner exclusion, remaining captured owner, nested complete declarations and disposal, including a later callback-capable preparer opening an owner before finalization.
- Scalar composition now runs native and recipient finalizers after the preparer loop, before returning the combined record. Membership native finalization runs before recipient finalizers; the existing membership compositor finalizes prepared units before installation. The scalar slot checks committed revision after preparation, before assigning value/installing evidence. The abort test reaches this boundary with a real prepared record: no write, completion, send or operation survives. Existing preparation-reentry and installation/completion controls also replay in the author selection. This does not qualify arbitrary user code inside a supposedly pure internal finalizer.
- Projection/horizon recomposition adds exact captured dependencies to owner wake edges. Terminal confirmation/rejection releases useful publication without an extra write; abandonment/disappearance is not treated as successful settlement. Disposal uses the existing operation retirement path. Tests establish finite lifecycle behavior, not universal GC or heap release.

## No-op comparison review

The source intentionally stores projectRevision's merged result in `proofs`, but compares prior stored proof with local `effective`. That syntactic asymmetry is not by itself a demonstrated bug. On the exercised paths, ready() begins from lifecycle.proof, which already includes the recipient window, and installs that authored requirement into the selected projection before computing `effective`. Re-merging therefore adds no new window identity in these cases.

Controls assert more than silence: an equal unknown write returns **no-write**, preserves the first conservative receipt, sends nothing while pending, and the first useful revision sends after confirmation. For undeclared secondary recipients, equal independent writes on the declaring channel do not discard the secondary held projection; confirm and rollback both produce the useful secondary send. Membership omission also preserves the window and wakes. No duplicate send or lost predecessor was reproduced. This is bounded evidence, not proof for every masked-projection/no-op shape; no code change is requested solely for stylistic symmetry.

## Concrete blocker

`lifecycle.ts:210` conflates recipient-only coverage uncertainty with missing declaration/origin completeness. The current owner authority explicitly preserves recipient-only ordinary fallback. Own traces show the disputed wider updater has clean native input evidence and a matching independent declaration; only recipient coverage is unknown. Its new fixed-window hold is therefore not justified by the inspected general bounded-window approval. The conflicting original hold test and stated task intent cannot silently waive that exception. See exact commit/line citations and narrow correction direction in `CONTRACT-ADJUDICATION.md`.

No author source changes, policy edits, public API approval, installed/browser validation, performance claim, or blanket green verdict follows.
