# Field-layout source explanation

Scope: read-only comparison of `packages/kernel/src/lib/experimental-publication/entity.ts` in predecessor `f165d28e55dce241ff6466a58c9b850f1bbc20f3` and the current integrated working tree. No profiling, tests, or production changes performed for this explanation. The run owner reports populated-heap medians 17,757,072 → 19,956,008 bytes (+12.38%) for 10 trees × 1,000 three-field rows; pending increments 1,032,976 → 1,086,040 bytes. Those are supplied measurement results, not measurements generated here.

## Persistent layout established by source

For a fully populated ordinary/physical row with three shared field names:

| Reachable representation | Predecessor | Integrated |
| --- | ---: | ---: |
| Per-row field Maps | 2 (ordinary and physical) | 1 (`cells`) |
| Row wrapper objects | 0 | 1 (`RowFacts`) |
| Explicit field-order arrays | 0 | 1 shared by both side properties when orders match |
| Current row revision token objects | 0 | 1 |
| Pair wrapper objects | 0 | 3 (`FieldFact`, one per field) |
| Ordinary endpoint objects | 3 | 3 |
| Physical View objects | 3 | 3 |

This replaces two per-row Maps with one Map plus six explicit objects (row, order array, revision, three pair wrappers). Excluding Map/array backing storage and the unchanged endpoints/Views, that is a net increase of five explicit JavaScript objects per such row: approximately 50,000 additional explicit objects over the stated 10,000-row workload, alongside 10,000 fewer per-row Maps. This is a cardinality statement, not a byte estimate. Divergent ordinary/physical insertion orders require two arrays rather than the shared one, adding another array for those rows. Empty and one-sided rows have different counts.

The predecessor Map entries directly referenced endpoints or Views. Integrated Map entries reference pair wrappers which in turn reference endpoints and Views. Thus fusion removes duplicate Map key/index storage but introduces a wrapper per union field and an extra indirection. Three shared field names formerly appeared in two Maps; they now appear in one Map and one order array. The explicit array is needed because the two logical sides can acquire fields in different orders; one union Map order cannot preserve both original orders.

The row wrapper also retains logical-side flags and two key-array references (often aliased). The revision token is necessary for stale retirement-plan detection when the direct point path updates a live row in place: container identity alone no longer changes. Generic cloning creates a new token; every installed point update replaces the token, including equal-value physical support changes. Only the current token is intrinsically retained by the current row; held retirement plans can additionally retain older tokens.

At participant scope, eight persistent top-level Maps become seven (the two field authorities become one). The six member/placement/mapping Maps are unchanged. New `escaped` and `preparing` WeakSets and an `exposeCompletion` WeakMap add three weak containers per participant. They preserve exposure/reentry semantics; weak entries do not by themselves strongly retain their keys. This does not establish their engine backing-store size or guarantee that values have no independent live references.

## Retention and allocations that depend on the workload

Ordinary endpoints and physical Views remain separate objects, and equal-value physical updates deliberately preserve and mutate the existing View. The representation does not eliminate these identities or their requirements. Initial generic preparation creates intermediate pair wrappers and separate key arrays that can be superseded or deduplicated before installation; unreachable intermediates are allocation traffic, not necessarily populated live heap.

A held generic completion can retain staged rows, side-touch Sets, selected evidence Maps/closures and physical snapshots. A held/exposed point completion seals detached evidence/support, may clone a row, and captures a physical image. An unexposed point can avoid that sealing and can install into the existing row. These are conditional costs; source inspection alone cannot establish which survive in either measured heap checkpoint. The WeakMap is not a permanent strong cache of all historical completions. Other changed modules and lifecycle/source completion retention are outside this file-scoped accounting.

## What the measurement does and does not establish

The reported screen establishes a regression for the measured integrated artifact/workload, including a smaller pending-increment regression. The new per-row wrappers, revisions, explicit order arrays and per-field pair wrappers provide a concrete source-supported explanation for why fewer Maps need not reduce retained memory, especially at only three fields per row. It does not prove how many of the extra bytes belong to each category, whether Map backing-store savings offset a particular category, or that this file accounts for the entire measured delta. Assigning bytes to individual objects would require heap attribution under the exact measured artifact and checkpoint; none is claimed here.
