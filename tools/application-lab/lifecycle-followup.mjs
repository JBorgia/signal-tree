#!/usr/bin/env node
// Finite lifecycle diagnostics. No comparative timing, byte budget or leak verdict.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [suppliedBase, suppliedVariant, suppliedOut, mode, suppliedPayloadCheck] =
  process.argv.slice(2);
assert.ok(
  suppliedBase &&
    suppliedVariant &&
    suppliedOut &&
    ['inventory-aging', 'publication-payloads'].includes(mode) &&
    process.argv.length <= 7 &&
    (mode !== 'publication-payloads' || suppliedPayloadCheck),
  'lifecycle-followup.mjs BASE_PACKET VARIANT_PACKET NEW_OUT inventory-aging|publication-payloads [PAYLOAD_CHECK_DIR]'
);
const out = resolve(suppliedOut);
assert.ok(!existsSync(out), 'Preserve prior diagnostics');
mkdirSync(out, { recursive: true });
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (name, value) => {
  const path = join(out, name);
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return { path, sha256: sha(path) };
};
const runner = fileURLToPath(import.meta.url);
const protocol = fileURLToPath(
  new URL(
    '../../docs/audits/2026-11-11-application-comparison/LIFECYCLE-FOLLOWUP.md',
    import.meta.url
  )
);
const scenario = mode === 'inventory-aging' ? 'inventory' : 'dispatch';
const checker = fileURLToPath(
  new URL(`./${scenario}-check.mjs`, import.meta.url)
);
const controls =
  scenario === 'inventory'
    ? {
        'drop-filter': 'filter-pump',
        'stale-count': 'valid-add',
        'invalid-add': 'invalid-add',
        'stale-editor': 'retired-editor',
        'skip-destroy': 'destroy',
      }
    : {
        'drop-write': 'overlap-proposals',
        'stale-preview': 'late-preview',
        'premature-publication': 'publish-held',
        'clobber-other-field': 'overlap-settle-first',
        'blanket-block': 'unrelated-progress',
        'stale-editor': 'retired-editor',
        'drop-reentry': 'reentrant-action',
        'skip-destroy': 'late-after-reset',
        'false-rejection': 'lost-ack-unknown',
        'stale-success': 'cas-stale-success',
      };
const bindings = {};
function bind(path, expected) {
  assert.match(expected, /^[a-f0-9]{64}$/, `Missing file hash: ${path}`);
  if (Object.hasOwn(bindings, path))
    assert.equal(bindings[path], expected, `Conflicting binding: ${path}`);
  bindings[path] = expected;
}
function bindMap(map) {
  for (const [path, hash] of Object.entries(map)) bind(path, hash);
}
function verify() {
  for (const [path, hash] of Object.entries(bindings))
    assert.equal(sha(path), hash, `Input drift: ${path}`);
}
const packets = [
  { variant: 'before', path: resolve(suppliedBase) },
  { variant: 'after', path: resolve(suppliedVariant) },
];
let chromium;
try {
  assert.notEqual(packets[0].path, packets[1].path);
  for (const path of [runner, protocol, checker]) bind(path, sha(path));
  for (const packet of packets) {
    const planPath = join(packet.path, 'plan.json');
    const buildPath = join(
      packet.path,
      scenario === 'inventory' ? 'build.json' : 'dispatch-build.json'
    );
    const conformancePath = join(
      packet.path,
      `${scenario}-conformance/results.json`
    );
    const plan = read(planPath),
      build = read(buildPath),
      conformance = read(conformancePath);
    assert.ok(
      plan.arms.includes('tanstack') &&
        new Set(plan.arms).size === plan.arms.length
    );
    assert.deepEqual(Object.keys(build.arms).sort(), [...plan.arms].sort());
    assert.equal(build.planSha256, sha(planPath));
    assert.equal(conformance.planSha256, build.planSha256);
    assert.equal(conformance.buildSha256, sha(buildPath));
    assert.equal(conformance.runnerSha256, sha(checker));
    assert.deepEqual(conformance.controls, controls);
    assert.equal(
      conformance.results.length,
      plan.arms.length * (Object.keys(controls).length + 1)
    );
    for (const arm of plan.arms) {
      const admitted = conformance.results.filter((entry) => entry.arm === arm);
      assert.deepEqual(
        admitted.map((entry) => entry.fault ?? 'baseline').sort(),
        ['baseline', ...Object.keys(controls)].sort()
      );
      for (const entry of admitted) {
        assert.equal(
          entry.passed,
          true,
          'Full exact-build conformance and controls first'
        );
        assert.ok(
          entry.events.length && entry.events.every((event) => event.passed)
        );
        if (entry.fault) {
          assert.equal(entry.detectedAt, controls[entry.fault]);
          assert.deepEqual(entry.browserErrors, []);
        }
        const path = join(
          packet.path,
          `${scenario}-conformance/${arm}-${entry.fault ?? 'baseline'}.json`
        );
        assert.deepEqual(read(path), entry);
        bind(path, sha(path));
      }
    }
    bindMap(plan.inputs);
    for (const arm of Object.values(build.arms)) {
      bindMap(arm.dependencies);
      bindMap(arm.served);
    }
    for (const path of [planPath, buildPath, conformancePath])
      bind(path, sha(path));
    packet.plan = plan;
    packet.directory = join(packet.path, `tanstack/dist/${scenario}/browser`);
    packet.served = build.arms.tanstack.served;
    assert.ok(
      Object.hasOwn(packet.served, join(packet.directory, 'index.html'))
    );
  }
  assert.deepEqual(packets[0].plan.arms, packets[1].plan.arms);
  assert.equal(
    packets[0].plan.toolchainDirectory,
    packets[1].plan.toolchainDirectory
  );
  assert.equal(
    packets[1].plan.variant.baselinePlanSha256,
    sha(join(packets[0].path, 'plan.json'))
  );
  assert.ok(
    packets[1].plan.variant.replacements.some(
      (entry) =>
        entry.arm === 'tanstack' &&
        entry.scenario === scenario &&
        entry.beforeSha256 !== entry.afterSha256
    )
  );
  if (suppliedPayloadCheck) {
    const directory = resolve(suppliedPayloadCheck);
    const path = join(directory, 'results.json'),
      schedulePath = join(directory, 'schedule.json');
    const evidence = read(path),
      schedule = read(schedulePath);
    assert.equal(evidence.passed, true);
    assert.equal(evidence.scheduleSha256, sha(schedulePath));
    assert.equal(evidence.results.length, 4);
    assert.equal(schedule.schedule.length, 4);
    assert.equal(
      new Set(evidence.results.map((entry) => entry.process.browserPid)).size,
      4
    );
    const payloadChecker = fileURLToPath(
      new URL('./publication-payload-check.mjs', import.meta.url)
    );
    assert.equal(evidence.bindings[payloadChecker], sha(payloadChecker));
    for (const packet of packets)
      for (const name of ['plan.json', 'dispatch-build.json']) {
        const path = join(packet.path, name);
        assert.equal(
          evidence.bindings[path],
          sha(path),
          'Payload proof must identify these exact builds'
        );
      }
    for (const label of ['baseline', 'variant']) {
      const entries = evidence.results.filter(
        (entry) => entry.packet === label
      );
      assert.deepEqual(
        entries.map((entry) => entry.fault ?? 'baseline').sort(),
        ['baseline', 'hide-public-payload']
      );
      for (const entry of entries) {
        assert.equal(entry.passed, true);
        assert.equal(entry.arm, 'tanstack');
        assert.deepEqual(entry.browserErrors, []);
        assert.ok(entry.process.browserPid > 0);
        const expected = schedule.schedule[entry.index];
        for (const [key, value] of Object.entries(expected))
          assert.equal(entry[key], value);
        if (entry.fault) {
          assert.equal(entry.detectedAt, 'started-payload');
          assert.equal(entry.expectedOracleFailure, true);
          assert.ok(entry.faultActivations > 0);
        } else {
          assert.ok(
            entry.stages.length >= 10 &&
              entry.stages.every((step) => step.passed)
          );
          assert.ok(
            entry.stages.some(
              (step) => step.name === 'detached-after-accepted-writes'
            )
          );
          assert.ok(
            entry.stages.some((step) => step.name === 'late-after-teardown')
          );
        }
        const child = join(
          directory,
          `${entry.index}-${entry.packet}-${entry.fault ?? 'baseline'}.json`
        );
        assert.deepEqual(read(child), entry);
        assert.equal(evidence.receipts[child], sha(child));
      }
    }
    bindMap(evidence.bindings);
    bindMap(evidence.receipts);
    for (const item of [path, schedulePath, join(directory, 'preflight.json')])
      bind(item, sha(item));
    assert.equal(read(join(directory, 'preflight.json')).passed, true);
  }
  const require = createRequire(
    join(packets[0].plan.toolchainDirectory, 'package.json')
  );
  ({ chromium } = require('playwright'));
  for (const name of ['playwright', 'playwright/package.json']) {
    const path = require.resolve(name);
    bind(path, sha(path));
  }
  // Bind the actual loaded automation module closure, not every node_modules file.
  for (const module of Object.values(require.cache))
    if (module.filename) bind(module.filename, sha(module.filename));
  verify();
  write('preflight.json', { passed: true, mode, bindings });
} catch (error) {
  write('preflight.json', {
    passed: false,
    mode,
    error: String(error.stack),
    bindings,
  });
  throw error;
}

const schedule = [];
for (const rows of [1000, 10000])
  for (let round = 0; round < 3; round++)
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after'])
      schedule.push({
        index: schedule.length,
        mode,
        arm: 'tanstack',
        rows,
        round,
        variant,
        processIdentity: randomUUID(),
      });
write('schedule.json', {
  createdUTC: new Date().toISOString(),
  command: [process.execPath, runner, ...process.argv.slice(2)],
  packets: Object.fromEntries(
    packets.map((packet) => [packet.variant, packet.path])
  ),
  mode,
  bindings,
  schedule,
  host: {
    node: process.version,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
  },
  workload:
    mode === 'inventory-aging'
      ? {
          filter: '',
          visibleRows: 40,
          editedIDs: 100,
          cumulativeEdits: [400, 1200, 2400, 4800],
          weakReferences:
            'Unique actual public row-value objects observed before checked renames; identity-replaced and still-current observations are distinguished.',
        }
      : {
          planBatches: [8, 8],
          acknowledgedAndPrunedBetweenBatches: true,
          acceptedOwnerWrites: 2,
          finalPendingOwnerWriteAndPlan: true,
          weakReferences:
            'Unique actual public payload objects at started/acknowledged reads, including replacement objects. Only weak references and scalar metadata/digests persist in the probe.',
        },
  gc: 'Three forced collections, each preceded and followed by a browser host-task boundary. Heap and weak-reference liveness sampled only afterward. Survivor snapshot at final destruction only, at most one per child; 512MiB disk cap preserves an incomplete file as a failed capture if exceeded.',
  limits: [
    'Diagnostic only: three matched fresh-browser pairs per size; no A/A controls, comparative timing, significance, winner or fitted byte threshold.',
    'Whole-application forced-GC JS heap includes diagnostic WeakRefs/metadata and warmed framework/library state. Publication mode also includes the deterministic backend and its retained common history until final late delivery.',
    'WeakRef liveness is an observation after specified GC attempts, not a universal collection guarantee or leak verdict. Current objects and backend history can legitimately keep objects live.',
    'Inventory tracks unique public getter identities, not every internal allocation. A mutable stable public identity is reported as still-current rather than automatically called superseded.',
    'Payload equality/digests are checked in-page; full plan payloads are not transferred to the harness. Public Object.isFrozen is not required.',
    'Heap snapshots include diagnostic objects and may differ from the preceding liveness sample. Survival requires retaining-path attribution; public removal alone does not prove private map reclamation.',
    'Five-minute diagnostic stage hang limits, 30-second failure-cleanup limits and the snapshot disk cap are execution bounds, not performance acceptance budgets.',
  ],
});

let activePacket;
const server = createServer((req, res) => {
  try {
    const name = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname
    );
    const path = resolve(
      activePacket.directory,
      '.' + (name === '/' ? '/index.html' : name)
    );
    if (
      !path.startsWith(activePacket.directory + sep) ||
      !Object.hasOwn(activePacket.served, path)
    ) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Type',
      path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.css')
        ? 'text/css'
        : 'text/html'
    );
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
});
const results = [],
  browserPids = new Set();
const bounded = (work, label, milliseconds = 300000) => {
  let timer;
  return Promise.race([
    work,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Diagnostic stage timeout: ${label}`)),
        milliseconds
      );
    }),
  ]).finally(() => clearTimeout(timer));
};

async function installProbe(page, rows) {
  await page.evaluate(
    ({ rows, mode }) => {
      const ensure = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const equal = (actual, expected, message) =>
        ensure(JSON.stringify(actual) === JSON.stringify(expected), message);
      const entries = [],
        seen = new WeakMap(),
        titles = new Map(),
        plans = new Map();
      let completedEdits = 0;
      const track = (object, id, capturedAt, digest) => {
        ensure(
          object !== null && typeof object === 'object',
          'WeakRef target must be an actual public object'
        );
        let entry = seen.get(object);
        if (!entry) {
          entry = {
            key: entries.length,
            id,
            capturedAt,
            digest,
            superseded: false,
            ref: new WeakRef(object),
          };
          entries.push(entry);
          seen.set(object, entry);
        } else if (digest)
          ensure(
            entry.digest === digest,
            'Previously observed payload was mutated'
          );
        return entry;
      };
      const digest = async (value) =>
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(value)
            )
          ),
          (byte) => byte.toString(16).padStart(2, '0')
        ).join('');
      const payloadText = (payload) => {
        equal(
          Object.keys(payload).sort(),
          ['capacity', 'kind', 'rows'],
          'Exact plan envelope'
        );
        ensure(
          payload.kind === 'plan' && payload.rows.length === rows,
          'Full plan row count'
        );
        equal(
          Object.keys(payload.capacity).sort(),
          ['instance', 'revision', 'value'],
          'Exact capacity envelope'
        );
        return JSON.stringify([
          'plan',
          payload.rows.map((row) => {
            equal(
              Object.keys(row).sort(),
              [
                'active',
                'id',
                'instance',
                'owner',
                'ownerRevision',
                'status',
                'statusRevision',
                'title',
              ],
              'Exact plan row envelope'
            );
            return [
              row.id,
              row.instance,
              row.title,
              row.owner,
              row.status,
              row.active,
              row.ownerRevision,
              row.statusRevision,
            ];
          }),
          [
            payload.capacity.instance,
            payload.capacity.value,
            payload.capacity.revision,
          ],
        ]);
      };
      const validateSeedPayload = (payload, owner, revision) => {
        equal(
          [
            payload.capacity.instance,
            payload.capacity.value,
            payload.capacity.revision,
          ],
          ['capacity-1', 4, 10],
          'Canonical capacity'
        );
        ensure(
          payload.kind === 'plan' && payload.rows.length === rows,
          'Complete canonical rows'
        );
        for (let index = 0; index < rows; index++) {
          const row = payload.rows[index];
          equal(
            [
              row.id,
              row.instance,
              row.title,
              row.owner,
              row.status,
              row.active,
              row.ownerRevision,
              row.statusRevision,
            ],
            [
              `J-${index}`,
              `initial-${index}`,
              `Inspect ${index % 3 === 0 ? 'pump' : 'valve'} ${index}`,
              index ? `Operator ${index % 10}` : owner,
              'queued',
              index % 2 === 0,
              index ? 10 : revision,
              10,
            ],
            `Canonical frozen row ${index}`
          );
        }
      };
      const checkInventory = () => {
        ensure(
          document.querySelector('[data-testid="filter"]').value === '',
          'Empty filter remains active'
        );
        const total = Number(
          document.querySelector('[data-testid="total"]').textContent.trim()
        );
        const matched = Number(
          document.querySelector('[data-testid="matched"]').textContent.trim()
        );
        ensure(total === rows && matched === rows, 'Inventory counts');
        const visible = [...document.querySelectorAll('tbody tr')];
        equal(
          visible.map((row) => row.getAttribute('data-job')),
          Array.from({ length: 40 }, (_, index) => `J-${index}`),
          'Insertion-order viewport'
        );
        for (let index = 0; index < 100; index++) {
          const id = `J-${index}`,
            title =
              titles.get(id) ??
              `Inspect ${index % 3 === 0 ? 'pump' : 'valve'} ${index}`;
          ensure(window.lab.row(id).title === title, `Stored title ${id}`);
          if (index < 40)
            ensure(
              visible[index]
                .querySelector('[data-field="title"]')
                .textContent.trim() === title,
              `Rendered title ${id}`
            );
        }
        return {
          completedEdits,
          checkedRows: 100,
          total,
          matched,
          visibleIDs: visible.map((row) => row.getAttribute('data-job')),
        };
      };
      const checkRetainedPayloads = async () => {
        let checked = 0;
        for (const entry of entries) {
          const value = entry.ref.deref();
          if (!value) continue;
          ensure(
            (await digest(payloadText(value))) === entry.digest,
            `Detached historical public payload ${entry.id}`
          );
          checked++;
        }
        return checked;
      };
      const checkPlans = async (publicIDs, publicState, expectedStarts) => {
        const state = window.lab.snapshot();
        equal(
          state.publications.map((item) => item.id),
          publicIDs,
          'Exact public publication IDs'
        );
        equal(
          state.starts.map((item) => item.id),
          Array.from(
            { length: expectedStarts },
            (_, index) => `life-plan-${index}`
          ),
          'Actual transport start order'
        );
        equal(
          state.publicationAttempts,
          state.starts.map((item) => item.id),
          'One transport attempt per started plan'
        );
        ensure(
          plans.size === expectedStarts,
          'Every start has immutable expected metadata'
        );
        for (const start of state.starts) {
          const expected = plans.get(start.id);
          validateSeedPayload(start.payload, expected.owner, expected.revision);
          ensure(
            (await digest(payloadText(start.payload))) === expected.digest,
            `Immutable backend history ${start.id}`
          );
        }
        for (const publication of state.publications) {
          ensure(
            publication.state === publicState,
            `Publication state ${publication.id}`
          );
          ensure(
            Object.hasOwn(publication, 'payload'),
            `Public payload remains exposed ${publication.id}`
          );
          const start = state.starts.find((item) => item.id === publication.id);
          ensure(
            payloadText(publication.payload) === payloadText(start.payload),
            `Public/transport equality ${publication.id}`
          );
          track(
            publication.payload,
            publication.id,
            publicState,
            plans.get(publication.id).digest
          );
          ensure(
            document
              .querySelector(
                `[data-publication="${publication.id}"] [data-field="state"]`
              )
              .textContent.trim() === publicState,
            'Rendered publication state'
          );
        }
        ensure(
          document.querySelectorAll('[data-publication]').length ===
            publicIDs.length,
          'Rendered publication count'
        );
        return {
          publicIDs,
          publicState,
          starts: state.starts.length,
          attempts: state.publicationAttempts.length,
          acknowledgements: state.acknowledged.length,
          operations: state.operations.length,
          applications: state.applications.length,
          canonicalOwner: state.canonical.owner,
          canonicalOwnerRevision: state.canonical.ownerRevision,
        };
      };
      window.__lifecycleProbe = {
        checkInventory,
        async renameUntil(end) {
          ensure(end > completedEdits && end <= 4800, 'Bounded forward aging');
          for (let index = completedEdits; index < end; index++) {
            const id = `J-${index % 100}`,
              title = `Lifecycle title ${index}`;
            const before = window.lab.row(id),
              entry = track(before, id, index);
            await window.lab.rename(id, title);
            const current = window.lab.row(id);
            entry.superseded ||= before !== current;
            ensure(current.title === title, `Accepted aging write ${index}`);
            if (index % 100 < 40)
              ensure(
                document
                  .querySelector(`[data-job="${id}"] [data-field="title"]`)
                  .textContent.trim() === title,
                `Visible aging write ${index}`
              );
            titles.set(id, title);
            completedEdits = index + 1;
          }
          return checkInventory();
        },
        async publishBatch(first, end, owner, revision) {
          ensure(
            end - first === 8 && first === plans.size && end <= 16,
            'Eight bounded new plans'
          );
          for (let index = first; index < end; index++) {
            const id = `life-plan-${index}`;
            await window.lab.publish(id, 'plan');
            const state = window.lab.snapshot(),
              publication = state.publications.find((item) => item.id === id),
              start = state.starts.find((item) => item.id === id);
            ensure(
              publication?.state === 'started' && start,
              'Held acknowledgement must leave a real started plan'
            );
            validateSeedPayload(start.payload, owner, revision);
            const text = payloadText(start.payload);
            ensure(
              payloadText(publication.payload) === text,
              'Initial public/transport payload equality'
            );
            const hash = await digest(text);
            plans.set(id, { owner, revision, digest: hash });
            track(publication.payload, id, 'started', hash);
          }
        },
        checkPlans,
        async acceptOwner(id, owner, revision) {
          await window.lab.assign('J-0', 'owner', owner, id);
          await window.lab.process(id, 'accept');
          const state = window.lab.snapshot();
          ensure(
            state.canonical.owner === owner &&
              state.canonical.ownerRevision === revision,
            'New accepted owner and revision'
          );
          ensure(
            state.operations.find((item) => item.id === id)?.outcome ===
              'applied',
            'Accepted owner operation'
          );
          ensure(
            document
              .querySelector('[data-job="J-0"] [data-field="owner"]')
              .textContent.trim() === owner,
            'Accepted owner rendered'
          );
          return {
            checkedHistoricalPayloads: await checkRetainedPayloads(),
            owner,
            revision,
          };
        },
        async acknowledge(first, end) {
          for (let index = first; index < end; index++)
            await window.lab.acknowledge(`life-plan-${index}`);
          equal(
            window.lab.snapshot().acknowledged,
            Array.from({ length: end }, (_, index) => `life-plan-${index}`),
            'Each held plan acknowledged exactly once'
          );
        },
        weakSample(live) {
          const current = new Map(),
            transport = new Map();
          if (live && mode === 'inventory-aging')
            for (let index = 0; index < 100; index++)
              current.set(`J-${index}`, window.lab.row(`J-${index}`));
          if (live && mode === 'publication-payloads') {
            const state = window.lab.snapshot();
            for (const publication of state.publications)
              current.set(publication.id, publication.payload);
            for (const start of state.starts)
              transport.set(start.id, start.payload);
          }
          const survivors = [];
          let collected = 0,
            stillCurrent = 0,
            transportIdentity = 0,
            observedSuperseded = 0;
          for (const entry of entries) {
            if (entry.superseded) observedSuperseded++;
            const value = entry.ref.deref();
            if (!value) {
              collected++;
              continue;
            }
            const isCurrent = live && current.get(entry.id) === value;
            const isTransport = live && transport.get(entry.id) === value;
            if (isCurrent) stillCurrent++;
            if (isTransport) transportIdentity++;
            survivors.push({
              key: entry.key,
              id: entry.id,
              capturedAt: entry.capturedAt,
              observedSuperseded: entry.superseded,
              stillCurrent: isCurrent,
              transportIdentity: isTransport,
            });
          }
          return {
            trackedUnique: entries.length,
            alive: survivors.length,
            collected,
            stillCurrent,
            transportIdentity,
            observedSuperseded,
            currentIdentityChecksAvailable: live,
            survivors,
          };
        },
      };
    },
    { rows, mode }
  );
}

async function run(sample, url) {
  activePacket = packets.find((packet) => packet.variant === sample.variant);
  const prefix = `${String(sample.index).padStart(3, '0')}-${sample.variant}-${
    sample.rows
  }`;
  const result = {
    ...sample,
    passed: false,
    hostStart: { load: os.loadavg(), freeBytes: os.freemem() },
    stages: [],
    receipts: {},
    browserErrors: [],
  };
  let browser,
    page,
    cdp,
    stage = 'input-verification',
    live = false;
  const call = (method, ...args) =>
    page.evaluate(async ({ method, args }) => window.lab[method](...args), {
      method,
      args,
    });
  const probe = (method, ...args) =>
    page.evaluate(
      async ({ method, args }) => window.__lifecycleProbe[method](...args),
      { method, args }
    );
  const boundary = () =>
    page.evaluate(() => new Promise((done) => setTimeout(done, 0)));
  async function step(name, work) {
    stage = name;
    const evidence = await bounded(work(), name);
    assert.deepEqual(result.browserErrors, []);
    const receipt = write(
      `${prefix}-stage-${String(result.stages.length).padStart(2, '0')}.json`,
      { sample, stage: name, passed: true, evidence }
    );
    result.receipts[receipt.path] = receipt.sha256;
    result.stages.push({ name, passed: true, receipt });
    return evidence;
  }
  async function checkpoint(
    name,
    evidence,
    backendLifetime = 'not-applicable'
  ) {
    return step(name, async () => {
      for (let pass = 0; pass < 3; pass++) {
        await boundary();
        await cdp.send('HeapProfiler.collectGarbage');
        await boundary();
      }
      const heap = await cdp.send('Runtime.getHeapUsage');
      assert.ok(
        Number.isFinite(heap.usedSize) && heap.usedSize > 0,
        'Recorded live JS heap'
      );
      const weak = await probe('weakSample', live);
      assert.equal(weak.alive + weak.collected, weak.trackedUnique);
      return {
        state: evidence,
        heapBytes: heap.usedSize,
        backingStorageBytes: heap.backingStorageSize,
        weak,
        backendLifetime,
        diagnosticObjectsIncluded: true,
      };
    });
  }
  async function saveSurvivorSnapshot(final) {
    if (final.weak.alive === 0) return;
    await step('final-survivor-snapshot', async () => {
      await boundary();
      const path = join(out, `${prefix}-final.heapsnapshot`);
      const fd = openSync(path, 'wx');
      let bytes = 0,
        truncated = false,
        writeError,
        captureError;
      const snapshotHash = createHash('sha256');
      const limit = 512 * 1024 * 1024;
      const listener = ({ chunk }) => {
        if (truncated || writeError) return;
        const data = Buffer.from(chunk);
        if (bytes + data.length > limit) {
          truncated = true;
          return;
        }
        try {
          let offset = 0;
          while (offset < data.length) {
            const written = writeSync(fd, data, offset, data.length - offset);
            assert.ok(written > 0, 'Snapshot write must make progress');
            snapshotHash.update(data.subarray(offset, offset + written));
            offset += written;
            bytes += written;
          }
        } catch (error) {
          writeError = error;
        }
      };
      cdp.on('HeapProfiler.addHeapSnapshotChunk', listener);
      try {
        await cdp.send('HeapProfiler.takeHeapSnapshot', {
          reportProgress: false,
        });
      } catch (error) {
        captureError = error;
      } finally {
        cdp.off('HeapProfiler.addHeapSnapshotChunk', listener);
        closeSync(fd);
      }
      result.finalSnapshot = {
        path,
        sha256: snapshotHash.digest('hex'),
        bytes,
        complete: !truncated && !writeError && !captureError,
        survivingWeakTargetsBeforeSnapshot: final.weak.alive,
      };
      result.receipts[path] = result.finalSnapshot.sha256;
      assert.ok(
        result.finalSnapshot.complete,
        `Snapshot capture incomplete: ${
          captureError ?? writeError ?? '512MiB cap'
        }`
      );
      return result.finalSnapshot;
    });
  }
  try {
    verify();
    stage = 'bootstrap';
    browser = await chromium.launch({ headless: true });
    const session = await browser.newBrowserCDPSession();
    try {
      const processes = await session.send('SystemInfo.getProcessInfo');
      const browserPid = processes.processInfo.find(
        (item) => item.type === 'browser'
      )?.id;
      result.process = {
        identity: sample.processIdentity,
        browserPid,
        harnessPid: process.pid,
        browserVersion: browser.version(),
      };
      assert.ok(
        Number.isSafeInteger(browserPid) &&
          browserPid > 0 &&
          !browserPids.has(browserPid)
      );
      browserPids.add(browserPid);
    } finally {
      await session.detach();
    }
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(120000);
    page.on('pageerror', (error) => result.browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') result.browserErrors.push(message.text());
    });
    cdp = await page.context().newCDPSession(page);
    await page.goto(`${url}/?rows=${sample.rows}`);
    await page.waitForFunction(() => window.lab?.ready, undefined, {
      timeout: 45000,
    });
    live = true;
    await call('stable');
    await installProbe(page, sample.rows);
    await step('initial-view', async () => {
      const ids = await page
        .locator('tbody tr')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-job'))
        );
      assert.deepEqual(
        ids,
        Array.from({ length: 40 }, (_, index) => `J-${index}`)
      );
      return { rows: sample.rows, visibleIDs: ids };
    });
    let final;
    if (mode === 'inventory-aging') {
      await checkpoint('populated', await probe('checkInventory'));
      for (const end of [400, 1200, 2400, 4800]) {
        const evidence = await step(`checked-edits-through-${end}`, () =>
          probe('renameUntil', end)
        );
        assert.equal(evidence.completedEdits, end);
        await checkpoint(`after-${end}-edits`, evidence);
      }
      await step('destroy', async () => {
        await call('destroy');
        live = false;
        assert.equal(await page.locator('lab-inventory main').count(), 0);
        return { renderedScreens: 0, completedEdits: 4800 };
      });
      final = await checkpoint('after-destroy', {
        completedEdits: 4800,
        renderedScreens: 0,
      });
    } else {
      await checkpoint(
        'populated',
        await probe('checkPlans', [], 'started', 0),
        'live-service-empty-history'
      );
      for (const first of [0, 8]) {
        const end = first + 8,
          ids = Array.from(
            { length: 8 },
            (_, index) => `life-plan-${first + index}`
          );
        await step(`start-plans-through-${end}`, async () => {
          await probe(
            'publishBatch',
            first,
            end,
            first === 0 ? 'Operator 0' : 'Accepted after eight',
            first === 0 ? 10 : 11
          );
          return probe('checkPlans', ids, 'started', end);
        });
        await step(`detach-after-accepted-write-${end}`, () =>
          probe(
            'acceptOwner',
            `accepted-${end}`,
            end === 8 ? 'Accepted after eight' : 'Accepted after sixteen',
            end === 8 ? 11 : 12
          )
        );
        await checkpoint(
          `${end}-total-started-held`,
          await probe('checkPlans', ids, 'started', end),
          'live-service-retains-all-started-plan-copies'
        );
        await step(`acknowledge-through-${end}`, async () => {
          await probe('acknowledge', first, end);
          return probe('checkPlans', ids, 'acknowledged', end);
        });
        await checkpoint(
          `${end}-total-acknowledged`,
          await probe('checkPlans', ids, 'acknowledged', end),
          'live-service-retains-all-started-plan-copies'
        );
        await step(`dismiss-through-${end}`, async () => {
          await call('dismissSettled');
          const evidence = await probe('checkPlans', [], 'acknowledged', end);
          assert.equal(evidence.operations, 0);
          return evidence;
        });
        await checkpoint(
          `${end}-total-pruned`,
          await probe('checkPlans', [], 'acknowledged', end),
          'live-service-retains-all-started-plan-copies'
        );
      }
      const pending = await step('submit-pending-teardown', async () => {
        await call(
          'assign',
          'J-0',
          'owner',
          'Pending teardown owner',
          'teardown-owner'
        );
        await call('publish', 'teardown-plan', 'plan');
        return page.evaluate(() => {
          const state = window.lab.snapshot(),
            publication = state.publications[0],
            operation = state.operations[0];
          if (
            state.publications.length !== 1 ||
            publication.id !== 'teardown-plan' ||
            publication.state !== 'waiting' ||
            publication.payload !== undefined ||
            JSON.stringify(publication.inputs) !==
              JSON.stringify(['teardown-owner']) ||
            state.operations.length !== 1 ||
            operation.id !== 'teardown-owner' ||
            operation.outcome !== 'pending' ||
            state.starts.length !== 16 ||
            state.publicationAttempts.length !== 16 ||
            state.applications.length !== 2 ||
            state.row.owner !== 'Pending teardown owner' ||
            state.canonical.owner !== 'Accepted after sixteen'
          )
            throw new Error('Pending teardown contract');
          return {
            publications: 1,
            operations: 1,
            starts: 16,
            attempts: 16,
            applications: 2,
            waitingInputs: publication.inputs,
          };
        });
      });
      await checkpoint(
        'before-pending-teardown',
        pending,
        'live-service-retains-sixteen-plan-copies'
      );
      await step('destroy-pending', async () => {
        await call('destroyPending');
        live = false;
        assert.equal(await page.locator('lab-dispatch main').count(), 0);
        return { renderedScreens: 0 };
      });
      await checkpoint(
        'after-destroy-before-late',
        { renderedScreens: 0 },
        'old-service-intentionally-retained'
      );
      const retired = await step('deliver-retired', async () => {
        const delivery = await call('deliverRetired', 'teardown-owner');
        assert.deepEqual(delivery, {
          applications: 3,
          starts: 16,
          publicationAttempts: 16,
        });
        assert.equal(await page.locator('lab-dispatch main').count(), 0);
        return delivery;
      });
      final = await checkpoint(
        'after-destroy-after-late',
        retired,
        'old-service-reference-released'
      );
    }
    await saveSurvivorSnapshot(final);
    result.finalWeakCounts = {
      trackedUnique: final.weak.trackedUnique,
      alive: final.weak.alive,
      collected: final.weak.collected,
    };
    result.passed = true;
  } catch (error) {
    result.failedAt = stage;
    result.error = String(error.stack);
    const receipt = write(`${prefix}-failure.json`, {
      sample,
      stage,
      error: result.error,
      browserErrors: result.browserErrors,
    });
    result.receipts[receipt.path] = receipt.sha256;
    result.stages.push({ name: stage, passed: false, receipt });
  } finally {
    const errors = [];
    try {
      if (live) await bounded(call('destroy'), 'failure cleanup', 30000);
    } catch (error) {
      errors.push(String(error.stack));
    }
    try {
      await bounded(browser?.close(), 'browser close', 30000);
    } catch (error) {
      errors.push(String(error.stack));
    }
    try {
      verify();
    } catch (error) {
      errors.push(String(error.stack));
    }
    if (result.browserErrors.length || errors.length) {
      result.passed = false;
      result.finalizationErrors = errors;
    }
    result.hostEnd = { load: os.loadavg(), freeBytes: os.freemem() };
  }
  return result;
}

try {
  await new Promise((yes, no) => {
    server.once('error', no);
    server.listen(0, '127.0.0.1', yes);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const sample of schedule) {
    const result = await run(sample, url);
    const receipt = write(
      `${String(sample.index).padStart(3, '0')}-${sample.variant}-${
        sample.rows
      }.json`,
      result
    );
    results.push({ ...result, receipt });
    console.log(
      mode,
      sample.rows,
      sample.round,
      sample.variant,
      result.passed ? 'passed' : `FAILED at ${result.failedAt}`
    );
    if (!result.passed) break;
  }
} catch (error) {
  write('runner-failure.json', { error: String(error.stack) });
  process.exitCode = 1;
} finally {
  if (server.listening) await new Promise((yes) => server.close(yes));
  const passed =
    results.length === schedule.length &&
    results.every((entry) => entry.passed) &&
    browserPids.size === schedule.length;
  write('results.json', {
    passed,
    mode,
    scheduleSha256: sha(join(out, 'schedule.json')),
    bindings,
    results,
    receipts: Object.fromEntries(
      results.flatMap((entry) => [
        [entry.receipt.path, entry.receipt.sha256],
        ...Object.entries(entry.receipts),
      ])
    ),
  });
  if (!passed) process.exitCode = 1;
}
