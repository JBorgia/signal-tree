# New validation-window probe: first failure preserved

The first added root probe tried to open late.transact inside target p's
transaction callback, through return-shape validation. The existing transaction
contract rejects nested transactions before the callback, including across trees.
Source: transactions.ts4546–4552; write-context.ts49–80; established controls
in after-commit-0.spec.ts224 and active-transaction-context.spec.ts67.

Thus late was never assigned, late.x remained0, and optional inspection equality
was vacuous.005 preserves this first failure and VALIDATION-WINDOW-PREREG.spec.ts
preserves the original exact test. This is a newly authored invalid fixture,
not a demonstrated runtime regression.

Corrected probe opens late after p's callback and before delivery/settlement,
uses nonoptional inspection and retains every intended hold/useful-delivery/value
assertion. No original inherited regression or runtime source is changed.
