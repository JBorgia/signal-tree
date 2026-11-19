# C6 explicit three-way composition

C6 is exact C5 plus cumulative reviewed dynamic enrollment, base construction cleanup, and shared keyed construction. No R2/R3 or public API changes. No root/predecessor edits.

Inputs and all file hashes are in INPUT-VERIFICATION.json and the three input manifests. The actual common base is /private/tmp/st-native-combined-c/candidate (C0), ours is C5, theirs is shared-construction f63ade892aa381b827f1db54986fbb2ca787cb1bde497847104bd0a40bd9dffe. Helmholtz's final review is preserved as REVIEW.md; its source hash is in FREEZE.json.

Every cumulative changed file was compared across all three inputs. All 19 changes have ours==base (or are genuinely new in both base/ours), so no newer C5 source was overwritten and no manual conflict resolution was required. COMPOSITION.json records each decision. All six enrollment runtime files equal reviewed shared source; all 23 C5 changes relative to C0 remain byte-identical (including packet, retirement, accounting/instrumentation, occurrence oracle). See PRESERVATION.json. Seven specs and twelve runtime files form the C5 delta. FROM-C5.patch is the complete reconstructable delta; SNAPSHOT-C6.json covers 2994 files.

The first incomplete assembly mistakenly used dynamic-enrollment as the merge base. It was never qualified or released. Its conflicts, manifest checks and partial candidate are preserved unchanged at /private/tmp/st-native-combined-c6-initial-assembly. Main identified the missing cumulative prerequisite; the corrected composition uses C0 and includes all six enrollment runtime files. No tests were run on that initial assembly.

## R3 integration remains unresolved

No joint R2 APIs were inserted. A future accepted R3 must bind the source publication node at actual construction adoption to the newly allocated LIVE scalar slot in both neutral and native leaf attachment closures. Binding only ordinary createLeaf, or detached local slot zero, misses adopted members. Native factories return leaf/token/attach: the source is the actual leaf, not that wrapper. Canceled construction must create no live source entry. Resolve this against exact accepted R3 interfaces and test both dynamic routes; do not guess a method call here.

Helmholtz's inherited parent snapshot observation is preserved without waiver: inside membership completion physical a exists, but rows() can still return the prior cached empty parent; a nested {...rows(),b} therefore omits a. Both prior cleanup and shared sources show it. C6 resource qualification does not establish snapshot freshness. R3 integration requires read-derived completion/reentry discrimination, alongside explicit-payload receipt controls.

## Qualification scope

Commands, pinned environment, first logs, exit status and before/after source inventories are under runs/. Nx is used with cache disabled and one worker. No broad suite, point ceiling, retention rerun, performance or universal heap claim. The accepted held/drop/no-attempt GC evidence remains component review evidence, not a fresh C6 measurement.

The retirement-enrollment command's enrollment-invariance substring matches publication-enrollment-invariance; recipient-domain matched no file. This is explicitly corrected by the separate exact recipient-cause-classification command. No claim that the unmatched filter executed.
