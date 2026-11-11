import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  symlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import { gzipSync } from 'node:zlib';

const [operation, suppliedInput, suppliedOutput, suppliedSample] =
  process.argv.slice(2);
assert.ok(
  ['build', 'measure', 'child'].includes(operation) &&
    suppliedInput &&
    suppliedOutput,
  'optional-seam.mjs build FROZEN_PACKET NEW_BUNDLES | measure BUNDLES NEW_RESULTS [ROUNDS] | child BUNDLES RESULT SAMPLE_JSON'
);
const runner = fileURLToPath(import.meta.url);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const write = (p, value) =>
  writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const input = resolve(suppliedInput),
  out = resolve(suppliedOutput);
if (operation === 'child') {
  const report = read(join(input, 'bundles.json'));
  assert.equal(
    sha(runner),
    report.runnerSha256,
    'Runner changed after bundle generation'
  );
  const sample = JSON.parse(suppliedSample);
  assert.ok(['v15', 'v16'].includes(sample.line));
  assert.ok(
    ['no-link', 'module-only', 'active-link'].includes(sample.activation)
  );
  assert.ok([1000, 10000].includes(sample.rows));
  const bundle = report.summaries.find(
    (b) =>
      b.line === sample.line &&
      b.mode ===
        (sample.activation === 'no-link' ? 'no-link' : 'link-available')
  );
  assert.equal(sha(bundle.bundlePath), bundle.bundleSha256, 'Bundle drift');
  const api = await import(pathToFileURL(bundle.bundlePath).href);
  assert.equal(typeof global.gc, 'function', 'Run child with --expose-gc');
  const stages = {};
  const timed = (name, work) => {
    const cpu = process.cpuUsage(),
      start = process.hrtime.bigint();
    const value = work();
    stages[name] = {
      elapsedNanoseconds: Number(process.hrtime.bigint() - start),
      cpuMicroseconds: process.cpuUsage(cpu),
    };
    return value;
  };
  const gcHeap = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((done) => setImmediate(done));
      global.gc();
    }
    return process.memoryUsage().heapUsed;
  };
  const settle = async (connection) => {
    if (connection) {
      await connection.settled();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
  };
  // Inputs exist before baseline GC. Their storage is excluded from retained deltas.
  const rows = Array.from({ length: sample.rows }, (_, i) =>
    Object.fromEntries([
      ['id', 'R-' + i],
      ...Array.from({ length: 8 }, (_, f) => ['v' + f, i * 10 + f]),
    ])
  );
  const result = {
    ...sample,
    pid: process.pid,
    node: process.version,
    bundleSha256: bundle.bundleSha256,
    reportSha256: sha(join(input, 'bundles.json')),
    stages,
    heapBytes: { before: await gcHeap() },
    host: {
      cpu: os.cpus()[0]?.model,
      load: os.loadavg(),
      freeBytes: os.freemem(),
    },
    passed: false,
  };
  let tree,
    connection,
    deliveries = 0,
    lastCount = -1,
    lastFirst = -1;
  try {
    tree = timed('emptyTree', () => api.create());
    if (sample.activation === 'active-link')
      connection = timed('attach', () =>
        api.attach(tree, (values) => {
          deliveries++;
          lastCount = values.length;
          lastFirst = values[0]?.v0 ?? -1;
        })
      );
    await settle(connection);
    result.heapBytes.emptyAfterActivation = await gcHeap();
    timed('populationIncludingInputCopies', () =>
      api.populate(
        tree,
        rows.map((row) => ({ ...row }))
      )
    );
    timed('firstAllRead', () => {
      assert.equal(api.read(tree).length, sample.rows);
    });
    assert.deepEqual(api.read(tree), rows);
    assert.equal(api.count(tree), sample.rows);
    await settle(connection);
    if (connection) {
      assert.equal(lastCount, sample.rows);
      assert.equal(lastFirst, 0);
    }
    result.heapBytes.populated = await gcHeap();
    // Distinct row writes: the endpoint assertion covers all 200 timed writes,
    // rather than letting a last-write-wins endpoint conceal intermediate failure.
    const performUpdate =
      sample.control === 'drop-final-point-write'
        ? (tree, id, changes) => {
            if (id !== 'R-199') api.update(tree, id, changes);
          }
        : api.update;
    timed('pointEdits200Distinct', () => {
      for (let i = 0; i < 200; i++)
        performUpdate(tree, 'R-' + i, { v0: 100000 + i });
    });
    await settle(connection);
    let actual = api.read(tree);
    assert.equal(actual.length, sample.rows);
    for (let i = 0; i < sample.rows; i++)
      assert.deepEqual(
        actual[i],
        i < 200 ? { ...rows[i], v0: 100000 + i } : rows[i]
      );
    if (connection) {
      assert.equal(lastCount, sample.rows);
      assert.equal(lastFirst, 100000);
    }
    // The borrowed list is dropped before GC; the endpoint retains no payload.
    actual = undefined;
    result.heapBytes.edited = await gcHeap();
    result.deliveries = deliveries;
    if (connection) {
      timed('disposeLink', () => connection.dispose());
      connection = undefined;
    }
    timed('destroy', () => tree.destroy());
    tree = undefined;
    result.heapBytes.destroyed = await gcHeap();
    result.passed = true;
  } catch (error) {
    result.error = {
      name: error?.name,
      message: String(error?.message ?? error),
      stack: error?.stack,
    };
    process.exitCode = 1;
  } finally {
    connection?.dispose();
    tree?.destroy();
    write(out, result);
  }
} else if (operation === 'measure') {
  assert.ok(!existsSync(out), 'Preserve previous attempts');
  mkdirSync(out, { recursive: true });
  const reportPath = join(input, 'bundles.json'),
    report = read(reportPath);
  assert.equal(
    sha(runner),
    report.runnerSha256,
    'Runner changed after bundle generation'
  );
  const rounds = suppliedSample === undefined ? 3 : Number(suppliedSample);
  assert.ok(Number.isInteger(rounds) && rounds > 0 && rounds <= 20);
  for (const bundle of report.summaries)
    assert.equal(sha(bundle.bundlePath), bundle.bundleSha256, 'Bundle drift');
  const schedule = [];
  for (const rows of [1000, 10000])
    for (let round = 0; round < rounds; round++) {
      const lines = round % 2 ? ['v16', 'v15'] : ['v15', 'v16'];
      const modes =
        round % 2
          ? ['active-link', 'module-only', 'no-link']
          : ['no-link', 'module-only', 'active-link'];
      for (const line of lines)
        for (const activation of modes)
          schedule.push({ line, activation, rows, round });
    }
  write(join(out, 'schedule.json'), {
    createdUTC: new Date().toISOString(),
    command: [process.execPath, runner, ...process.argv.slice(2)],
    runnerSha256: sha(runner),
    reportPath,
    reportSha256: sha(reportPath),
    schedule,
    limits:
      'Neutral kernel activation diagnostic, not Angular rendering or equivalent full-workflow timing. Three GCs separated by JS jobs per heap stage. Shared host; scheduling must be externally serialized. No warm-up discarded. Distinct 200 row updates; Link endpoint retains only counters. Each child is a fresh process.',
  });
  const results = [];
  for (let index = 0; index < schedule.length; index++) {
    const resultPath = join(out, `${String(index).padStart(3, '0')}.json`);
    const command = [
      '--expose-gc',
      runner,
      'child',
      input,
      resultPath,
      JSON.stringify(schedule[index]),
    ];
    const child = spawnSync(process.execPath, command, {
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, NODE_ENV: 'production' },
    });
    writeFileSync(
      resultPath + '.log',
      (child.stdout ?? '') + (child.stderr ?? ''),
      { flag: 'wx' }
    );
    const result = existsSync(resultPath) ? read(resultPath) : undefined;
    write(resultPath + '.invocation.json', {
      command: [process.execPath, ...command],
      exit: child.status,
      signal: child.signal,
      error: child.error ? String(child.error) : null,
      resultSha256: result ? sha(resultPath) : null,
    });
    if (result) results.push(result);
    console.log(
      index,
      schedule[index].line,
      schedule[index].activation,
      schedule[index].rows,
      result?.passed ? 'passed' : 'FAILED'
    );
    if (child.status !== 0 || !result?.passed) break;
  }
  const passed =
    results.length === schedule.length && results.every((r) => r.passed);
  write(join(out, 'results.json'), {
    passed,
    reportSha256: sha(reportPath),
    scheduleSha256: sha(join(out, 'schedule.json')),
    results,
  });
  if (!passed) process.exitCode = 1;
} else {
  const packet = input;
  const planPath = join(packet, 'plan.json');
  const plan = read(planPath);
  const toolchain = plan.toolchainDirectory;
  const require = createRequire(join(toolchain, 'package.json'));
  const { build, version: esbuildVersion } = require('esbuild');
  assert.ok(!existsSync(out), 'Preserve prior bundle attempts');
  mkdirSync(out, { recursive: true });
  symlinkSync(
    join(toolchain, 'node_modules'),
    join(out, 'node_modules'),
    'dir'
  );
  for (const [path, expected] of Object.entries(plan.inputs))
    assert.equal(sha(path), expected, `Input drift ${path}`);
  const summaries = [];
  for (const line of ['v15', 'v16']) {
    const kernel = join(packet, line, 'node_modules/@signal-tree/kernel');
    const pkg = read(join(kernel, 'package.json'));
    const entry = resolve(kernel, pkg.exports['.'].import);
    const artifact = plan.artifacts[line + '-kernel'];
    const archiveDigest =
      'sha512-' +
      createHash('sha512')
        .update(readFileSync(artifact.archive))
        .digest('base64');
    assert.equal(archiveDigest, artifact.integrity);
    for (const mode of ['no-link', 'link-available']) {
      const id = line + '-' + mode;
      const source = `import {signalTree,entityMap${
        mode === 'link-available' ? ',link' : ''
      }} from ${JSON.stringify(entry)};
export function create(){ return signalTree({rows:entityMap({selectId:row=>row.id})}); }
export function populate(tree,rows){tree.$.rows.setAll(rows);}
export function update(tree,id,changes){tree.$.rows.updateOne(id,changes);}
export function read(tree){return tree.$.rows.all();}
export function count(tree){return tree.$.rows.count();}
${
  mode === 'link-available'
    ? 'export function attach(tree,sink){return link(tree.$.rows,{set:sink});}'
    : ''
}
`;
      const sourcePath = join(out, id + '.entry.mjs');
      writeFileSync(sourcePath, source, { flag: 'wx' });
      const outfile = join(out, id + '.production.mjs');
      const result = await build({
        entryPoints: [sourcePath],
        outfile,
        bundle: true,
        minify: true,
        treeShaking: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' },
        external: ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'],
        metafile: true,
        logLevel: 'silent',
      });
      writeFileSync(
        join(out, id + '.metafile.json'),
        JSON.stringify(result.metafile, null, 2) + '\n',
        { flag: 'wx' }
      );
      const contributed = Object.values(result.metafile.outputs).flatMap(
        (output) =>
          Object.entries(output.inputs)
            .filter(([, data]) => data.bytesInOutput > 0)
            .map(([path, data]) => ({ path, bytes: data.bytesInOutput }))
      );
      const publication = contributed.filter(
        ({ path }) =>
          path.includes('/experimental-publication/') ||
          path.endsWith('/lib/link.js') ||
          path.includes('/internals/entity-publication')
      );
      const includedLink = contributed.some(({ path }) =>
        path.endsWith('/lib/link.js')
      );
      const includedEntityParticipant = contributed.some(({ path }) =>
        path.endsWith('/experimental-publication/entity.js')
      );
      assert.equal(includedLink, mode === 'link-available');
      if (line === 'v16')
        assert.equal(includedEntityParticipant, mode === 'link-available');
      const output = readFileSync(outfile);
      summaries.push({
        line,
        mode,
        packageVersion: pkg.version,
        sourceCommit: artifact.sourceCommit,
        sourceSeal: artifact.sourceSeal,
        archiveIntegrity: artifact.integrity,
        sourcePath,
        sourceSha256: sha(sourcePath),
        bundlePath: outfile,
        bundleSha256: sha(outfile),
        rawBytes: output.length,
        gzipBytes: gzipSync(output, { level: 9 }).length,
        includedLink,
        includedEntityParticipant,
        publication,
        contributed,
      });
    }
  }
  const report = {
    createdUTC: new Date().toISOString(),
    command: [process.execPath, process.argv[1]],
    runnerSha256: sha(process.argv[1]),
    planPath,
    planSha256: sha(planPath),
    node: process.version,
    esbuildVersion,
    toolchain,
    options: {
      productionDefines: true,
      minify: true,
      treeShaking: true,
      target: 'es2022',
      platform: 'browser',
      external: ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'],
    },
    limits:
      'Neutral kernel consumer fixture, not an Angular app. Exported attach forces a reachable Link facility while the child can omit subscriptions. Source is frozen installed baseline4; no source/runtime mutation. Bundle sizes include the small common consumer wrapper.',
    summaries,
  };
  writeFileSync(
    join(out, 'bundles.json'),
    JSON.stringify(report, null, 2) + '\n',
    { flag: 'wx' }
  );
  console.log(
    JSON.stringify(
      {
        out,
        bundles: summaries.map(
          ({
            line,
            mode,
            rawBytes,
            gzipBytes,
            includedLink,
            includedEntityParticipant,
            publication,
          }) => ({
            line,
            mode,
            rawBytes,
            gzipBytes,
            includedLink,
            includedEntityParticipant,
            publicationBytes: publication.reduce((n, x) => n + x.bytes, 0),
          })
        ),
      },
      null,
      2
    )
  );
}
