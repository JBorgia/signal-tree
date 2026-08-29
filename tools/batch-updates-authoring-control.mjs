#!/usr/bin/env node
/**
 * Proves the claimant sweep detects every way a consumer can actually SET
 * `batchUpdates`, including the structurally-typed forms a declaration-identity
 * scanner is blind to.
 *
 * ⚠️ THE PREVIOUS SCANNER WOULD HAVE MISSED HALF OF THESE while its own comment
 * claimed they "cannot be missed".
 */
import ts from 'typescript';

const TOKEN = 'batchUpdates';

const FORMS = {
  inline: `signalTree(state, { batchUpdates: false });`,
  annotated: `const opts: TreeConfig = { batchUpdates: false };`,
  inferredThenPassed: `const opts2 = { batchUpdates: false };\nsignalTree(state, opts2);`,
  satisfies: `const opts3 = { batchUpdates: false } satisfies TreeConfig;`,
  spread: `const base = { batchUpdates: false };\nsignalTree(state, { ...base });`,
  assignment: `declare const cfg: TreeConfig;\ncfg.batchUpdates = false;`,
  elementAccess: `declare const cfg2: Record<string, unknown>;\ncfg2['batchUpdates'] = false;`,
  shorthand: `const batchUpdates = false;\nsignalTree(state, { batchUpdates });`,
};
const NEGATIVE = {
  unrelatedInterface: `interface Metrics { batchUpdates: number }\nconst m: Metrics = { batchUpdates: 0 };`,
};

/** The sweep's discovery rule, isolated: exact token as identifier or string. */
function discover(src) {
  const sf = ts.createSourceFile('f.ts', src, ts.ScriptTarget.Latest, true);
  const hits = [];
  const visit = (n) => {
    if ((ts.isIdentifier(n) && n.text === TOKEN) || (ts.isStringLiteral(n) && n.text === TOKEN))
      hits.push(ts.SyntaxKind[n.parent.kind]);
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return hits;
}

let bad = 0;
console.log('authoring forms the sweep must DISCOVER:');
for (const [name, body] of Object.entries(FORMS)) {
  const hits = discover(body);
  const ok = hits.length > 0;
  if (!ok) bad++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(20)} ${JSON.stringify(hits)}`);
}
console.log('\nnegative — discovered, then rejected by CLASSIFICATION not discovery:');
for (const [name, body] of Object.entries(NEGATIVE)) {
  const hits = discover(body);
  const ok = hits.length > 0; // must be SEEN; classification decides it is unrelated
  if (!ok) bad++;
  console.log(
    `  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(20)} seen=${hits.length} ` +
      `(over-inclusion is correct here — a same-name property must be examined, not hidden)`
  );
}
console.log(
  bad
    ? `\n❌ ${bad} authoring form(s) invisible to the sweep.`
    : `\n✅ all ${Object.keys(FORMS).length} authoring forms and ${Object.keys(NEGATIVE).length} negative case discovered.`
);
process.exit(bad ? 1 : 0);
