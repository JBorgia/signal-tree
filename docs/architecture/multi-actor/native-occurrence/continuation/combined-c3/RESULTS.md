# C3 packet composition

C2 plus independently reviewed stable packet admission/indexing and deferred pre-admission correction. The ordinaryPlacements property from C2 is preserved; its sole producer returns frozen nonempty arrays/rows, or a mutable empty array. Existing consumers do not mutate the empty case; no general stabilization claim for arbitrary placement metadata follows. Source/patch origins and added tests are in COMPOSITION.json. The reviewed occurrence oracle correction is test-only and its original file and source-differential failures remain preserved separately.

Fresh Main Nx replay: **109 passes / 11 failures**, 16 files. All eleven match the existing packet/structural failure ledger: eight private admission fixture/oracle differences and three structural sequence cases. No additional failure in this selection. This is bounded composition, not acceptance; the point-work ceiling remains unqualified/failed. Source-before/after and command identity are in runs/packet-composition.

No production activation, budget change or release.
