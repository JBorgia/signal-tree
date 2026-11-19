# Local sharing prerequisite and plan

Original52-pass candidate stays unchanged. Baseline/initial counted Nx runs both execute six value/ordering-asserting workloads. Counted scope is final patch capture, physical+ordinary intervals, visibility seed, and earlier key scan; downstream visibility algorithm/source allocation is excluded and unchanged.

Measurements before followup: initial has same native+explicit tuples as baseline (4N including ordinary interval), row clones5N vs4N, one fewer array, visits9N vs10N, freezes8N+5 vs6N+4. It is not demonstrated as a general allocation improvement.

Allowed local sharing: Map iteration produces a fresh entry tuple independent of the Map's stored row. Replace that tuple's row with a frozen shallow placement record, freeze and retain the tuple itself; no second explicit tuple. prepareInterval may use that exact after record when explicitly supplied entries and the record is frozen. Unsupplied or unfrozen records continue to clone. Placement records contain primitive keys/adjacency; no public payload aliases. Existing interval continuity, before copies, ordinary visibility overrides and lifetime rules remain unchanged. New test explicitly asserts after-row identity reuse and mutable-entry defensive copy. Original snapshot test and work gate remain byte-identical.
