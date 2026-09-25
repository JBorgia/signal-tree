// INCUMBENT RUNNER. The pure judging logic lives in
// `candidate-conformance-core.mjs`; this file only wires it to the
// revision-pinned `current.mjs` adapter and writes a report.
//
// It is NOT runnable from the committed docs copy on its own: `current.mjs` is
// the gitignored, revision-selected adapter. That is deliberate — the evidence
// that must run from a clean checkout is the SELF-TEST, which imports the core
// and nothing else.
import { writeFileSync } from 'node:fs';
import { create, provenanceFor } from './current.mjs';
import { runConformance, PUBLICATION_SCOPE } from './candidate-conformance-core.mjs';

const { rows, violations } = await runConformance(create);

const report = {
  provenance: provenanceFor(import.meta.url),
  kind: 'settlement-or-refusal-conformance',
  publicationScope: PUBLICATION_SCOPE,
  outcomes: Object.fromEntries(rows.map((x) => [x.id, x.outcome])),
  violations,
  publicationUnverified: rows.filter((x) => x.publicationVerified === false).map((x) => x.id),
  rows,
};
console.log(JSON.stringify({ outcomes: report.outcomes, violations, publicationUnverified: report.publicationUnverified }, null, 2));
const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
process.exitCode = violations.length ? 1 : 0;
