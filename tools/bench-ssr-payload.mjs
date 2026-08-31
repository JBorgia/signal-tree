#!/usr/bin/env node
/**
 * What SSR state transfer actually costs, in bytes.
 *
 * `docs/guides/ssr-and-hydration.md` quotes a payload-size curve and a
 * shipped-then-dropped figure. Both came from throwaway probes on the first
 * pass, which is the exact defect the numeric-claims gate exists to catch — and
 * it caught them, in a doc written by the person who built the gate. This file
 * is the generator those numbers needed.
 *
 *   node tools/bench-ssr-payload.mjs
 *   node tools/bench-ssr-payload.mjs --json
 */
import {
  signalTree,
  entityMap,
} from '../dist/packages/kernel/dist/index.js';

const JSON_ONLY = process.argv.includes('--json');
if (JSON_ONLY) {
  globalThis.ngDevMode = false;
}

const rows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    email: `p${i}@example.com`,
  }));

const kb = (s) => s.length / 1024;

// ── 1. Payload size vs collection size ──────────────────────────────────────
// The payload is inlined into the HTML, so this is page weight, not heap.
const curve = [100, 1000, 10000].map((n) => {
  const t = signalTree({
    rows: entityMap({ selectId: (r) => r.id }),
  });
  t.$.rows.setAll(rows(n));
  return { rows: n, kb: kb(JSON.stringify(t.$())) };
});

if (JSON_ONLY) {
  console.log(JSON.stringify({ curve }, null, 2));
} else {
  console.log(
    `\nSSR payload — inlined into the HTML, so this is page weight\n`
  );
  console.log(`  rows      payload`);
  for (const c of curve) {
    console.log(
      `  ${String(c.rows).padStart(5)}    ${c.kb.toFixed(0).padStart(5)} KB`
    );
  }
  console.log(
    `\n  Linear. At grid scale the state payload dominates the page —` +
      `\n  transfer a first page, or mark the collection transient: true.\n`
  );
}
