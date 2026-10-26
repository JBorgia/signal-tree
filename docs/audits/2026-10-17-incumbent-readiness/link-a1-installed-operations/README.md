# A1 installed-operation checkpoint — rejected for integration

Runtime checkpoint: `d0e7d1659900b18c9a63d280f409c0448a0c1d80`, based on rejected `f01ed39a7df8a5de185ebec0773e09e36537dacb`.
A0 design: `4ed3b6094404f59b940e601626408dbbadbec588`.
Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`; B remains closed.

[Disposition and exact replay](DISPOSITION.md) separate scoped successes from
three native ordinary-presence failures, an ordinary public reentry stale send,
and controlled invalidation failure. The combined A1 reentry regression preserves
native A777/B12 but delivers A11/B12 after settled(). No further runtime repair,
full qualification, build, benchmark or collectibility run follows this boundary.

- [Ordinary-presence trace](SOURCE-PRESENCE-GAP.md) and [independent review](ORDINARY-PRESENCE-REVIEW.md).
- [Public reentry review](REENTRY-REVIEW.md), including independent combined-source confirmation.
- [Controlled invalidation review](INVALIDATION-REVIEW.md).
- [Pending aggregate scope proposal](AGGREGATE-PROPOSAL.md): not owner-approved.
- [Raw evidence archive](raw-evidence.tar.gz), [per-file manifest](EVIDENCE-MANIFEST.json), [archive hashes](ARCHIVE-SHA256.json).
- [Local candidate bundle](candidate.bundle): one rejected research commit; requires f01 base. It is not a patch to merge or activate.

The raw archive contains original logs, immutable source overlays, probe builders,
first failed assertions, corrected scalar evidence and later unchanged falsifiers.
The final spec-types ratchet passes with existing baseline diagnostics; it is not
an assertion of zero historical diagnostics. Earlier vectors overlap and are not
summed into a unique passing count. Original temporary locations remain available.

A successor first needs a reviewed ordinary-presence source owner and a complete
operation delivery rule preserving callback-authored chronology. Adding another
Link ticket, rereading physical rows, or delaying a flush does not establish these
facts. A0's intended capability remains required; these failures reject this native
implementation, not the product requirement or contribution ownership generally.
