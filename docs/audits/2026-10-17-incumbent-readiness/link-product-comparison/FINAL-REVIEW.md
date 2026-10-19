# Final comparison addendum

Reviewed current `examples.ts`, `examples-before-overwrite-control.ts`, `overwrite-control-final.log`, and comparative `README.md` in `/private/tmp/link-product-comparison`. Source and supplied execution-output review only; no rerun by this reviewer, no production/public API edits.

## O3 evidence gap closed narrowly

The source diff adds one pre-rejection drain and three assertions without removing or weakening the original assertions:

- sent payloads equal `[42]`;
- the wrapper owner is still `pending`;
- two entries remain queued (the explicitly unknown entry and deferred dependent entry, identifiable from setup and drain source).

The final log reports all eight checks satisfying their assertions. This closes the earlier execution gap: the explicit independent replacement now demonstrably sends before rejection, while dependent/unknown entries remain held in this application sample. Actual pending transaction lifetime is supported by the setup and absence of a settlement call before the assertion, not solely by trusting the wrapper string. The source/report now warrant “O3 demonstrates independent superseding intent while the real transaction remains open.”

It does not qualify automatic discovery of independent overwrites, same-value kernel revision semantics, concurrent supersession during in-flight delivery, correct ownership declarations generally, or wrapper lifecycle authority. Previous caveats remain. The preserved artifacts are named `examples-before-overwrite-control.ts` and `results-before-overwrite-control.json` (not literal `before-overwrite-control.*`).

## Comparative README verdict

No substantive overclaim requiring another experiment found. The README appropriately:

- distinguishes product visibility from correctness and treats drafts as a valid alternative;
- separates explicit outbox ownership from automatic effect propagation;
- marks runtime cost unmeasured and scores as qualitative inferences;
- identifies D3/O5 as deliberate leak witnesses;
- distinguishes real kernel exercise from application glue, and straight-line O1 copies from reactive propagation;
- preserves lack of lifecycle/durability qualification, concurrent-drain duplicates, failure-blocked later entries and acknowledgement ambiguity;
- limits the draft preference to review-before-save workflows and does not claim a universal winner or remove live proposals;
- leaves production, public API and B unchanged.

The qualified recommendation for isolated review is a defensible product judgment based on existing documented application ownership plus the demonstrated slice. It is not a theorem that drafts have lower total cost, nor does the README present it as one. The explicit-outbox alternative likewise remains serious despite needing publication declarations; the negative control exposes its contract rather than disqualifying explicit responsibility as a product.

Two small wording improvements would make the evidence harder to misread, without requiring tests:

1. In the score table, replace “no global FIFO stall in sample” with “skips pending-owner entries in O1.” The present wording is qualified and the later failure caveat is explicit, but the replacement states exactly what ran and avoids implying failure-independent scheduling.
2. In execution history, `with-negative-control.log` is the earlier eight-check run; `overwrite-control-final.log` and current `results.json` are the final strengthened run. Calling the former “Final” immediately before explaining a later final run is unnecessarily ambiguous. Identify the logs by sequence.

The relative provenance link at the bottom is appropriate only after this README is placed beside `link-provenance-feasibility/` in the intended repository audit layout; it does not resolve from the current temporary directory. This is an archive placement check, not a substantive comparison defect.

Disposition: research comparison is supportable with its explicit boundaries. O3's narrow missing witness is repaired. No production outbox, full eight-discriminator qualification, framework integration, measured cost winner, API selection, or replacement authority follows.
