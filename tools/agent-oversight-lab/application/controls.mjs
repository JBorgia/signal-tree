import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { runApplicationChecks } from './checks.mjs';

const [buildArg, outputArg] = process.argv.slice(2);
assert(buildArg && outputArg, 'controls.mjs BUILD_MANIFEST NEW_OUTPUT');
const here = dirname(fileURLToPath(import.meta.url)),
  out = resolve(outputArg),
  buildPath = resolve(buildArg);
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const build = JSON.parse(readFileSync(buildPath));
assert(build.complete);
mkdirSync(out);
const bindings = {
  [buildPath]: sha(buildPath),
  [fileURLToPath(import.meta.url)]: sha(fileURLToPath(import.meta.url)),
  [join(here, 'checks.mjs')]: sha(join(here, 'checks.mjs')),
};
const originalSite = join(build.work, 'site');
for (const [file, expected] of Object.entries(build.emitted)) {
  assert.equal(sha(join(originalSite, file)), expected);
  bindings[join(originalSite, file)] = expected;
}
for (const file of ['process.mjs', 'server.mjs', 'store.mjs'])
  bindings[join(here, '../durable-authority', file)] = sha(
    join(here, '../durable-authority', file)
  );
const faults = [
  {
    id: 'native-false-success',
    selected: 'independent-approved-effect',
    expected: 'ORACLE:native-owner-not-settled',
    transform(code) {
      const pattern =
        /(\w+)\.status==="applied"\?(\w+)\.native\.confirm\(\):\2\.native\.rollback\(\)/g;
      assert.equal(
        [...code.matchAll(pattern)].length,
        1,
        'Unique application settlement expression'
      );
      return code.replace(pattern, 'void 0');
    },
  },
  {
    id: 'hidden-history-gap',
    selected: 'redacted-gap-aware-bounded-investigation',
    expected: 'ORACLE:missing-gap-warning',
    transform(code) {
      const before =
        'Incomplete evidence \\u2014 a gap or retention limit prevents a complete history';
      assert.equal(
        code.split(before).length,
        2,
        'Unique retained-history warning'
      );
      return code.replace(before, 'Complete history; no gaps');
    },
  },
  {
    id: 'ignored-entity-lifetime',
    selected: 'replacement-refusal-and-explicit-recovery',
    expected: 'ORACLE:entity-lifetime-rejection',
    backend: true,
  },
];
const report = {
  buildManifest: buildPath,
  bindings,
  command: process.argv,
  results: [],
  limits:
    'Isolated application/backend mutants; no production fault flags or weakened positive oracles.',
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  for (const fault of faults) {
    const directory = join(out, fault.id),
      site = join(directory, 'site'),
      evidence = join(directory, 'evidence');
    mkdirSync(directory);
    cpSync(originalSite, site, { recursive: true });
    mkdirSync(evidence);
    let startAuthority;
    if (fault.backend) {
      const backend = join(directory, 'durable-authority');
      mkdirSync(backend);
      for (const file of ['process.mjs', 'server.mjs', 'store.mjs'])
        cpSync(join(here, '../durable-authority', file), join(backend, file));
      const source = join(backend, 'store.mjs'),
        before = readFileSync(source, 'utf8');
      const pattern =
        /if\s*\(\s*!reason\s*&&\s*\(!entity\s*\|\|\s*entity\.instance\s*!==\s*command\.proposal\.expectedInstance\)\s*\)\s*reason\s*=\s*'instance';/g;
      assert.equal(
        [...before.matchAll(pattern)].length,
        1,
        'Unique lifetime enforcement'
      );
      writeFileSync(
        source,
        before.replace(
          pattern,
          '/* Planted defect: omitted lifetime enforcement. */'
        )
      );
      startAuthority = (
        await import(pathToFileURL(join(backend, 'process.mjs')).href)
      ).startAuthorityProcess;
      report.results.push({ id: fault.id, mutantSha256: sha(source) });
    } else {
      const app = join(site, 'app.js');
      writeFileSync(app, fault.transform(readFileSync(app, 'utf8')));
      report.results.push({ id: fault.id, mutantSha256: sha(app) });
    }
    const result = await runApplicationChecks(browser, site, evidence, {
      selected: [fault.selected],
      ...(startAuthority ? { startAuthority } : {}),
    });
    const detected =
      !result.passed &&
      result.cases.length === 1 &&
      result.cases[0].error?.includes(fault.expected);
    Object.assign(report.results.at(-1), {
      expected: fault.expected,
      detected,
      result,
    });
    writeFileSync(join(out, 'receipt.json'), JSON.stringify(report, null, 2));
    assert(detected, 'Mutant missed its named oracle: ' + fault.id);
  }
  for (const [path, hash] of Object.entries(bindings))
    assert.equal(sha(path), hash, 'Input drift');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  writeFileSync(join(out, 'receipt.json'), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify({
    output: out,
    passed: report.passed,
    controls: report.results.map(({ id, detected }) => ({ id, detected })),
    error: report.error,
  })
);
