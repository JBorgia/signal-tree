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
  loader,
  serialization,
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
  }, { enhancers: [serialization()] });
  t.$.rows.setAll(rows(n));
  return { rows: n, kb: kb(t.serialize()) };
});

// ── 2. a source-owning marker: shipped, and what arrives ────────────────────
// SUBJECT MIGRATED from asyncSource (deleted by ASYNC-SOURCE-RETIRE-1) to a
// loader-backed entityMap — the surviving marker that owns a live source.
// The marker owns a live source, so it decides whose data is fresher. Under
// `rehydrate` it assumes the payload is old storage and declines — the bytes
// travel and the client refetches. Under `transfer` it accepts. RFC 0014.
const N = 500;
const mk = () => ({
  feed: entityMap({ selectId: (r) => r.id, load: loader(async () => []) }),
  n: 0,
});

const server = signalTree(mk(), { enhancers: [serialization()] });
server.$.feed.setAll(rows(N));
const withData = server.serialize();
const emptyPayload = signalTree(mk(), { enhancers: [serialization()] }).serialize();

const declined = signalTree(mk(), { enhancers: [serialization()] });
declined.deserialize(withData);

const accepted = signalTree(mk(), { enhancers: [serialization()] });
accepted.deserialize(withData, { transfer: true });

const shipped = kb(withData) - kb(emptyPayload);
const sourceMarkerResult = {
  rows: N,
  shippedKb: shipped,
  // Counted, not read through an accessor. An early version of this measurement
  // read `.value?.()` on a CALLABLE node, which returns undefined whether
  // hydration worked or not, and so "proved" the drop without testing it.
  underRehydrate: declined.$.feed.count() === 0 ? 'dropped' : 'delivered',
  underTransfer: accepted.$.feed.count() === 0 ? 'dropped' : 'delivered',
};

if (JSON_ONLY) {
  console.log(
    JSON.stringify({ curve, sourceMarker: sourceMarkerResult }, null, 2)
  );
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
  console.log(`asyncSource — a marker that owns a live source (${N} rows)\n`);
  console.log(`  shipped in the payload   ${shipped.toFixed(1)} KB`);
  console.log(`  deserialize()            ${sourceMarkerResult.underRehydrate}`);
  console.log(`  { transfer: true }       ${sourceMarkerResult.underTransfer}`);
  console.log(
    `\n  Without the flag the bytes travel and the client refetches:` +
      `\n  the payload AND the spinner. See RFC 0014.\n`
  );
}
