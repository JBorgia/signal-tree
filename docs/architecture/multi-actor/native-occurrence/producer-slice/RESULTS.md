# Native successor — first bounded producer slice

Candidate: /private/tmp/st-native-reviewed-successor/candidate
Frozen predecessor: /private/tmp/st-occurrence-successor (all2918 manifest files unchanged).
Untouched comparison copy: baseline-control (same2918 verified).
Mechanism authorization: /private/tmp/st-native-endpoint-composition/final-independent-review/REVIEW.md plus Main's explicit scratch authorization.

## Implemented native runtime slice

Three private runtime files changed. PreparedValueReplacement.authoredFields is now mandatory. Six frame callers classify replacement explicitly: placement/inverse realization, full add-overwrite, replaceOne literal/derive, updateMany fields, upsertMany fields, setAll whole. Realization maps to its previous native value-transition behavior; it does not acquire new authorship. Ordinary/inspection participation stays separate.

entity-signal retains each frame replacement's classification by exact mutation-step ordinal, with frozen field lists. EntityPublicationStep carries that source-issued authoredFootprint separately from value-diff fields. The direct updateOne path also emits its explicit field classification through the same step shape. The added native test observes whole/partial/derive classifications even when value-diff fields are empty. No consumer treats classification as native ownership.

This is an implementation slice, NOT the full reviewed native mechanism. Existing value-diff fields and proof assignment deliberately remain unchanged until native disposition is available. Inspection-only publication still follows its existing suppressed ordinary-step route; complete physical-demand selection has not been integrated. Optional step footprint supports existing non-replacement paths; frame replacement classification itself is compile-required. No full source output materializer, observer snapshot, persistent root, global index, public export or activation was added.

## Exact results

Commands use Node24.15.0/pnpm10.17.0; Nx environment NX_DAEMON=false NX_ISOLATE_PLUGINS=false. Test logs preserve full command output.

- Baseline Nx: occurrence-successor + equal/inverse16 + netzero12:40 passed. Diagnostic output baseline-observations.jsonl.
- First slice Nx: native-authored-footprint, native-certificate-successor, occurrence-successor, equal/inverse, netzero, entity-publication-work-lifetime, entity-mutation-frame:51 pass/4 fail. Preserved slice-nx-first.log.
- Final focused Nx additionally includes collection-contributor-core, native-admission-segments and native-structural-composition-gates:67 pass/5 fail. final-nx.log. This is not a green gate.
- Unchanged control: native-certificate-successor + entity-publication-work-lifetime:4pass/4fail (control-nx.log); native-structural-composition-gates:2pass/1fail (control-structural.log). All5 failure names/assertion outcomes match.
- `corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json`: pass, source-types.log.
- `node tools/check-spec-types.mjs`: initially2 inherited core fixture errors plus1 in each copied diagnostic root-link fixture. Preserved spec-types-first.log. Applied previously authorized core fixture-only patch and explicit bounded snapshot-reader generic in the copied diagnostics. Emitted JS unchanged for all3 (fixture-emission.json). Final spec gate passes (spec-types-final.log). No public types/assertions weakened or baseline ratcheted.
- 28 baseline/final native diagnostic stage records compare exactly, including roles, requirement identity, values, receipt/delivery and settlement errors. Observational passes preserve known proof defects, not prove their correction.

Final command (candidate cwd):
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false ST_OBSERVATIONS=/private/tmp/st-native-reviewed-successor/final-observations.jsonl corepack pnpm nx test kernel --skip-nx-cache native-authored-footprint.spec.ts native-certificate-successor.spec.ts occurrence-successor.spec.ts native-equal-inverse-diagnostic.spec.ts native-netzero-diagnostic.spec.ts entity-publication-work-lifetime.spec.ts entity-mutation-frame.spec.ts collection-contributor-core.spec.ts native-admission-segments.spec.ts native-structural-composition-gates.spec.ts

## Failure classification and remaining scope

1. Original literal restoration still holds old support. Authored classification now survives producer preparation, but native admission-to-proof and prepared membership payload selection are unimplemented; this is not a recurrence of a completed correction.
2. Same-tree equal/inverse/netzero defects remain exactly as baseline. Native responsibility is prepared after publication currently; a footprint-only clean proof would be unsafe. Required next slice: bind admitted/retained/normalized-away outcomes, certified presence/absence endpoints, actual special baseline composition, paired member normalization, selected inverse and ordinary/physical lowering. None is claimed implemented here.
3. Three work/lifetime tests fail before their work loops at entity-leaf occurrence enrollment (`Native occurrence has no verified root/address`). Exact unchanged control reproduces. No retention/work conclusion can be taken from those failed tests.
4. Structural compound inspection rollback order mismatch reproduces unchanged (received b,c,a vs expected a,b,c). Preserved, not patched as part of scope classification.
5. Actual output-demand registration before member snapshot, once-per-request source capture, staged recipient-slot render replacing existing materialization, frontier/reentry validation and retained-completion disposal remain unimplemented. Real builder/render/reference counters must accompany that integration; literal-zero projectionCounts is not evidence. source.inspect/RecipientOccurrences.inspect sampling belongs outside measured work.

No broader benchmarks, B, SDK integration or public activation. This candidate is frozen for Main's archive/review of the concrete producer slice, not final acceptance. The source/fixture patches, native first failures, original control failures, unique observation outputs and source identity are retained here. Future work should use another successor if preserving this exact freeze.
