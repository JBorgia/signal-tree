import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const sourcePaths = {
  jobs: 'apps/react-reference/src/app/reference-store.ts',
  products: 'apps/demo/src/app/examples/features/fundamentals/examples/entities/entities-demo.component.ts',
};

// Execute the actual app store/factory/method bodies. Only import realization,
// seed injection, and the documented v15 transaction spelling are adapted.
// Inventory computed/signal are deliberately explicit reads: Angular scheduling
// and rendering are outside this neutral state-layer measurement.
export async function loadApp(root, kernel, kind, legacy = false) {
  let source = readFileSync(resolve(root, sourcePaths[kind]), 'utf8');
  const kernelUrl = pathToFileURL(resolve(kernel, 'dist/index.js')).href;
  if (kind === 'jobs') {
    source = source.replace("from '@signal-tree/kernel'", `from '${kernelUrl}'`)
      .replace('const INITIAL_JOBS:', 'export const INITIAL_JOBS:')
      .replace('createReferenceStore = () =>', 'createReferenceStore = (benchmarkSeed?: Job[]) =>')
      .replace('setAll(INITIAL_JOBS)', 'setAll(benchmarkSeed ?? INITIAL_JOBS)');
    if (legacy) source = source.replaceAll('.transact(', '.transaction(');
    source += '\nexport const seeds = INITIAL_JOBS; export const createApp = createReferenceStore;\n';
  } else {
    source = source.replace(/import\s*\{[^}]*\}\s*from '@angular\/core';/s, '')
      .replace(/import\s*\{[^}]*\}\s*from '@angular\/forms';/s, '')
      .replaceAll("from '@signal-tree/angular'", `from '${kernelUrl}'`)
      .replace(/@Component\([\s\S]*?(?=export class EntitiesDemoComponent)/, '')
      .replace('const createInventoryTree = () =>', 'const createInventoryTree = (seed = INITIAL_PRODUCTS) =>')
      .replace('addMany(INITIAL_PRODUCTS.map(', 'addMany(seed.map(')
      .replace('private nextProductId = 5;', 'private nextProductId = benchmarkSeed ? Math.max(...benchmarkSeed.map(row => row.id)) + 1 : 5;')
      .replace('readonly store = createInventoryTree();', 'readonly store = createInventoryTree(benchmarkSeed);');
    source += `
export const seeds = INITIAL_PRODUCTS;
let benchmarkSeed;
function signal(initial) {
  let value = initial;
  const read = () => value;
  read.set = (next) => { value = next; };
  return read;
}
const computed = (read) => read;
export function createApp(seed) {
  benchmarkSeed = seed;
  try { return new EntitiesDemoComponent(); }
  finally { benchmarkSeed = undefined; }
}
`;
  }
  const code = stripTypeScriptTypes(source, { mode: 'transform' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

export function rowsFor(seeds, n, kind) {
  if (n === seeds.length) return seeds.map(row => ({ ...row }));
  return Array.from({ length: n }, (_, i) => ({ ...seeds[i % seeds.length],
    id: kind === 'jobs' ? (i < seeds.length ? seeds[i].id : `J-CAP-${i}`) : i + 1,
  }));
}

export function observe(app, kind) {
  if (kind === 'jobs') return {
    visible: app.$.visibleJobs(), activeCount: app.$.activeJobCount(),
    hidden: app.$.selectionHiddenByFilters(), default: app.$.filtersAreDefault(),
    selected: app.$.jobs.activeEntity(), team: app.$.filters.team(),
    show: app.$.filters.showCompleted(),
  };
  return {
    visible: app.visibleProducts(), available: app.availableCount(),
    selected: app.selectedProduct(), held: app.heldProduct(),
    blocked: app.blockedOperation(), event: app.lastEvent(),
  };
}

export function modelFor(rows, kind) {
  return { rows: rows.map(row => ({ ...row })), kind,
    team: 'North', show: true, selected: kind === 'jobs' ? 'J-104' : 1,
    filter: 'all', blocked: null, event: 'No committed mutations yet' };
}

export function actionFor(model, i) {
  const id = model.rows[i % model.rows.length].id;
  if (model.kind === 'jobs') {
    switch (i % 6) {
      case 0: return ['team', model.team === 'North' ? 'South' : 'North'];
      case 1: return ['show', !model.show];
      case 2: return ['select', id];
      case 3: return ['advance', id];
      case 4: return ['reset'];
      default: return ['requeue', id];
    }
  }
  switch (i % 6) {
    case 0: return ['filter', model.filter === 'all' ? 'available' : 'all'];
    case 1: return ['toggle', id];
    case 2: return ['select', id];
    case 3: return ['rename', id, `Product ${i}`];
    case 4: return ['reject'];
    default: return ['toggle', id];
  }
}

export function applyApp(app, kind, [op, id, value]) {
  if (kind === 'jobs') {
    if (op === 'team') app.setTeam(id);
    else if (op === 'show') app.setShowCompleted(id);
    else if (op === 'select') app.selectJob(id);
    else if (op === 'advance') app.advance(id);
    else if (op === 'reset') app.resetFilters();
    else app.$.jobs.updateOne(id, { status: 'queued' });
  } else {
    if (op === 'filter') app.setFilter(id);
    else if (op === 'toggle') app.toggleAvailability(id);
    else if (op === 'select') app.selectProduct(id);
    else if (op === 'rename') app.store.$.products.updateOne(id, { name: value });
    else app.tryRejectedAdd();
  }
}

function visible(model) {
  return model.rows.filter(row => model.kind === 'jobs'
    ? row.team === model.team && (model.show || row.status !== 'done')
    : model.filter === 'all' || row.availability === model.filter);
}

export function applyModel(model, [op, id, value]) {
  const row = model.rows.find(row => row.id === id);
  if (model.kind === 'jobs') {
    if (op === 'team') model.team = id;
    else if (op === 'show') model.show = id;
    else if (op === 'select') model.selected = id;
    else if (op === 'reset') { model.team = 'North'; model.show = true; }
    else if (op === 'advance') {
      const successor = model.show ? id : visible(model).find(row => row.id !== id)?.id;
      row.status = 'done';
      if (successor !== id) model.selected = successor;
    } else row.status = 'queued';
  } else {
    if (op === 'filter') model.filter = id;
    else if (op === 'select') model.selected = id;
    else if (op === 'reject') model.blocked = 'Rejected before commit: blank name';
    else {
      if (op === 'toggle') row.availability = row.availability === 'available' ? 'reserved' : 'available';
      else row.name = value;
      model.blocked = null;
      model.event = `Updated ${row.name} after commit`;
    }
  }
}

export function check(observed, model) {
  const selected = model.rows.find(row => row.id === model.selected);
  const expected = model.kind === 'jobs' ? {
    visible: visible(model),
    activeCount: model.rows.filter(row => row.team === model.team && row.status === 'active').length,
    hidden: selected ? !visible(model).includes(selected) : false,
    default: model.team === 'North' && model.show,
    selected, team: model.team, show: model.show,
  } : {
    visible: visible(model),
    available: model.rows.filter(row => row.availability === 'available').length,
    selected, held: model.rows[0], blocked: model.blocked, event: model.event,
  };
  assert.deepEqual(observed, expected);
}

export function destroy(app, kind) {
  if (kind === 'jobs') app.destroy();
  else app.ngOnDestroy();
}

export function selftest(module, kind, n) {
  const rows = rowsFor(module.seeds, n, kind);
  const app = module.createApp(rows);
  const model = modelFor(rows, kind);
  try {
    check(observe(app, kind), model);
    for (let i = 0; i < 120; i++) {
      const action = actionFor(model, i);
      applyApp(app, kind, action);
      applyModel(model, action);
      check(observe(app, kind), model);
    }
    const output = observe(app, kind);
    assert.throws(() => check({ ...output, visible: [] }, model));
    assert.throws(() => check({ ...output, selected: { id: 'wrong' } }, model));
    return { assertions: 121, negativeControls: 2 };
  } finally { destroy(app, kind); }
}
