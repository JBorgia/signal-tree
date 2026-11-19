# Independent entity-anchor move result

Verdict: no objection found in the bounded move. Exact predecessor/successor diff removes collection registration on raw api and registers on final proxy after construction, before return. Row/field bindings and provenance/address validation are unchanged. Proxy defineProperty forwarding preserves the collection symbol on its target while anchors[source] now records the published identity. No duplicate registration.

Source reviewed: /private/tmp/st-entity-anchor-successor/candidate
Scratch tested: /private/tmp/st-anchor-independent-oo7vdnvz/candidate
entity-signal.ts SHA256: a2319dec7f66aa7f33f8a89a27951946553f50771496a3ceaf77ad7590c15ef9
Test SHA256: cdddc1f888d9fab4e17bec2e5e6cecb5e013e3713c43296657ea96c0993de7e6
Full focused identities: IDENTITIES.json. Verified 946 copied package files unchanged after testing; only new fixture added. Compared reviewed entity-signal.ts back to Main candidate at completion, identical. No writes to Main or predecessor.

## Actual results

- Nx focused runtime: exit 0, 7/7 passed on first run.
- Focused fixture typecheck: exit 0 on first run, strict=true; inherits repository spec configuration including skipLibCheck=true. This is not full spec-types or package acceptance.

Runtime command (cwd scratch candidate):

    NX_DAEMON=false NX_ISOLATE_PLUGINS=false /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/corepack pnpm nx test kernel --testFile=native-anchor-independent.spec.ts --maxWorkers=1 --skip-nx-cache

Type command:

    node node_modules/typescript/bin/tsc -p tsconfig.anchor-review.json

Raw first logs: first-run.log and focused-types-first.log. The Nx discovery output includes an inherited archived docs tsconfig EXTENDS_RESOLVE warning for missing /private/tmp/st-unknown-access-candidate/tsconfig.typecheck-all.json; execution continued and the selected Vitest file passed all seven cases. No config was weakened or edited to hide it.

## Assertions exercised

For both bare and transaction-enhanced trees (six tests total):
1. Exact published collection identity is anchor; collection capture has one ordinary edge; retained row and field capture have the correct exact source, root, parent collection, subject/field key and entity edge. Binding object remains unchanged.
2. Nested literal keys outer.dot / rows.dot have address ['outer.dot','rows.dot'], not split strings. Captured ancestry and final field edge name the actual collection/field.
3. Same path and public row key in two trees retain different sources, registries and occurrence roots, each with its own collection anchor.

Seventh test constructs standalone createEntitySignal with a real PathNotifier: binding and exact collection anchor exist, but registry/address remain absent and capture still throws Native occurrence has no verified root/address. No fake registry/address or metadata bypass.

Test source: /private/tmp/st-anchor-independent-oo7vdnvz/candidate/packages/kernel/src/lib/native-anchor-independent.spec.ts
Portable fixture-only patch: /private/tmp/st-anchor-independent-oo7vdnvz/fixture-only.patch
Exact reviewed runtime diff: /private/tmp/st-anchor-independent-oo7vdnvz/reviewed-move.patch

No broad suite, lifecycle correction, or public-Link delivery rerun here; Main owns the unchanged diagnostic/link-native-address/audit-entity-boundaries runs. This proves only the focused anchor obligations. It does not establish that all 52 inherited failures are fixed or resolve separate downstream lifecycle gaps. First predecessor diagnostic remains untouched at /private/tmp/st-retained-source-successor/runs/anchor-first/first.log.
