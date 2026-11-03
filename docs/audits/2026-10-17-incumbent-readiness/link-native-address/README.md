# Native entity Link address — bounded correction passes

October 25, 2026. Continues the [derive and snapshot successor](../derive-placement-successor/README.md)
recorded at `dabd300245e772b413f958fa8e680a22d48aeaa7`. Production remains
`87f6831fa60cafe87508f0ace84b7638698ca3b0`. Candidate source stays isolated in
`/private/tmp/link-fallback-successor/candidate`; no runtime integration, API change,
activation, later-slice restart, release, ceiling increase or reopening B.

## Disposition and corrected attribution

The eight inherited entity-field omission timeouts now pass unchanged. The defect
was a source-address mismatch, not a missing scheduling wake or a requirement to
install transactions. A bare field has native entity location facts but lacks the
optional capture position metadata. Experimental Link bound its publication source
to position -1; native notifications carried the actual collection position. The
projection matcher therefore delivered no ticket to Link. Conservative fallback
callbacks ran twice but could not authorize a nonexistent ticket.

This supersedes the earlier provisional interpretation that owner initialization
was the first causal discriminator. The earlier unknown:true/false observation
remains valid; absence of a token was correlated, not the first blocking boundary.
Raw trace logs, source hashes and the predecessor's reports are preserved.

The only runtime change is in link.ts: derive publicationPosition from the existing
entityLocation.owner (collection position), otherwise preserve existing owned-position
lookup, and reuse that address at six existing binding/acquisition/admission/permission/
declaration sites. Tree registry, subject lifetime and field identity remain separate.
No new owner registration, unknown-to-independent conversion, flush or permission
bypass. Eligibility and conservative fallback semantics are unchanged. This is a
bounded correction to the isolated declared-Link experiment, not production approval.

## Evidence

| Execution | Result and limits |
| --- | --- |
| New 10 control first run on unchanged predecessor | 7 failures / 3 passes; exact first test body and log retained |
| Corrected new 10 plus original own-property 28 | 38 passes; includes all eight original timeout cases |
| Prior 45-file vector plus new 10 | 495 passes / 1 failure, 496 cases in 46 files; original assertion retained |
| Affected delivery plus final new 10 | 72 passes in 5 files; overlaps combined new 10, not additive unique total |
| Four facade checks | 8 passes, bare/enhanced omission then useful authored update for Angular, React, Vue and Solid |
| Rebuilt unchanged declaration/projection/lifecycle witnesses | 141 passing contract checks plus 1 hidden-input omission misuse demonstration; misuse excluded from safety passes |
| Independent native ingress/dependency probe | Pass; root replay and input hash verification agree |
| Types and lint | Source typecheck passes; corrected spec-types ratchet passes unchanged; changed-file lint: 0 errors / 0 warnings |

One combined failure remains the already-adjudicated test-contract mismatch from
c0f55f0d: the test performs an explicit whole-row replacement adopting inspected99,
then an identity updater, and expects no publication. Approved replacement adoption
requires99. Identity-only no-op controls pass. Original assertion and red output
remain intact; no wholesale green-gate claim or assertion correction is made here.

First new test diagnostics are archived: optional seeded handles needed explicit
existence guards; the intentionally unresolved endpoint promise needed an explanatory
comment for lint. Assertions were not relaxed. The disposal case was strengthened
from diagnostic-only cleanup to require actual endpoint I/O before disposal. Final
kernel 10 reran after those test-only edits. Runtime and all original assertions were
unchanged after the combined run. Framework type gates blocked initial React/Vue/
Solid runtime executions; corrected facade runs each pass 2. Angular runtime initially
passed 2; all final facade results are recorded separately.

New checks retain useful delivery for ordinary numeric edits and omitted fields,
same-number subjects in separate collections, rekey and same-key lifetime isolation,
inspection exclusion, foreign pending holds, serialized in-flight correction and
three disposal cycles. Unchanged witnesses exercise ABA responsibility refresh,
multiple owners/connections, nested validation/getter reentry, rejection under
inspection, callback/endpoint errors, async misuse, terminal receipts and current
metadata counts after 8 cycles. Destruction controls preserve the distinction between
tree destruction and explicit disposal; they do not promise cancellation of already
started endpoint I/O. No retained-receipt/entity GC qualification follows from counts.

## Exact source, review and remaining gates

Full 798-file TS/TSX manifest SHA256:
`16d33224f969b9e284e61c8affbacd544d1ebfba6397ae69f9a3cb2030008935`.
Parent 783-file TS manifest:
`171d0220bc85054979e88fd11eceea74fc0904f29d4ce033777020ea9c232b9f`.
The manifest cardinalities differ because current inventory additionally covers TSX;
only link.ts runtime and five new spec files differ from the frozen parent.
Reviewed link.ts SHA256:
`f74fa84fb70f2de16ec4e445e0d69d88e695ecadb6dedc59074acfd413cfa8c2`.
All parent manifest entries verified against the untouched predecessor; all unchanged
existing assertions and current loaded inputs verified. Archive final/overlay and
PATCH.diff reconstruct the successor atop that predecessor.

Independent review challenged collection/tree/field/lifetime identity, authoritative
incoming acquisition, unknown eligibility, reentry and disposal. Its probe uses two
bare collections with equal subject IDs: incoming5 updates A without echo while B7
is held behind a foreign pending transaction; confirmation releases B7, later A6
sends, disposal prevents A8. Root verified the loaded source hashes and replayed it.
No concrete blocker was demonstrated for this address correction. Reviewer did not
claim full integration, lifecycle GC, performance or release acceptance.

The prior updater footprint repair and ordinary-order successes remain bounded
source evidence. Existing-row prepend still measures 4N snapshot entries versus 2N
comparator (improved from6N); no new measurement or CPU inference. Production costs,
collectibility, structural integration, later-slice gates and current artifact blockers
remain unresolved. This change removes the traced Link timeouts, not those gates.
No broad kernel/framework suites, installed artifacts, demo build, CPU/heap campaign
or budget acceptance were run or inferred.

## Replay and archive

[Evidence archive](evidence.tar.xz), [archive hash](ARCHIVE.sha256),
[116 member hashes](MEMBERS.sha256). Archive SHA256:
`d7d68df934daa7c4649abf3be4e1943da45559297715056a7f2ca49c2e5fb929`.
Archive COMMANDS.md records toolchain, reconstruction, all focused commands and
limits. combined/COMMAND.json retains the exact failing46-file argument vector.
Each external witness is byte-for-byte preserved and bundled against current native
source with input hashes; historical source-patching loaders are not reused.

```sh
cd /private/tmp/link-fallback-successor/candidate
PATH=/private/tmp/derive-placement-successor/toolchain:$PATH COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=src/lib/link-native-address.spec.ts --testFile=src/lib/entity-own-property-audit.spec.ts --skip-nx-cache
node /private/tmp/link-fallback-successor/replay-controls.mjs
```

Node24.15.0 and pinned pnpm10.17.0, with the existing external pnpm shim for Nx's
nested command. No runner/config/dependency changes. Facade runs log an inherited
archived-tsconfig discovery warning; tests and project type commands succeed.

Record verification: archive hash and all 116 member hashes pass; all 798 current
source hashes match. Diff checks pass. The existing docs-loader invocation of
`tools/check-doc-links.mjs` reports 751/751 relative links resolving across 185 live
surfaces. These are archive/document checks, not release verification. Unrelated
AGENTS.md and measurement-contract edits remain excluded.
