# Exact expected case identities

Read from the frozen shared fixtures. Require this set in installed and production-bundled modes, with no duplicate, missing or extra case result. These are the same 20 logical cases, not new coverage. Case-count constants belong only to the new tool's expected-result contract; do not change fixture assertions.

## Original eight (`cases.mjs`)

1. `field independent useful9`
2. `row independent useful9`
3. `collection independent useful9`
4. `field independent foreign window`
5. `collection independent foreign window`
6. `field dependent foreign input`
7. `row dependent foreign input`
8. `collection dependent foreign input`

## Lifecycle six (`lifecycle.mjs`)

1. `pre-Link pending field confirm`
2. `pre-Link pending field rollback`
3. `pre-Link pending collection confirm`
4. `pre-Link pending collection rollback`
5. `late collection multiple Links confirm`
6. `late collection multiple Links rollback`

## Receipt six (`receipt-cases.ts`)

1. `field changed receipt / independent`
2. `field changed receipt / dependent`
3. `row changed receipt / independent`
4. `row changed receipt / dependent`
5. `collection changed receipt / independent`
6. `collection changed receipt / dependent`

## Separate controls

`no-link.mjs`: require exactly one success record with scope `separate production no-Link entity transactions`, `confirmed: 7`, `rolledBack: 7`, `passed: true`, plus exit zero. Execute installed and bundled; production output must contribute zero bytes from Link and the entity publication factory modules. Do not include this control in the 20-case total.

`facade-imports.mjs`: installed five-package import/identity/public-export control, exit zero and existing success marker. This is not five extra entity behavior cases.

## Limits preserved

Original-eight receipt states are observations. Receipt-six owns exact receipt assertions. Lifecycle pre-Link pending tests start after API module evaluation; “late collection” does not mean genuinely late first registration. No runtime source instrumentation or private factory activation is allowed.
