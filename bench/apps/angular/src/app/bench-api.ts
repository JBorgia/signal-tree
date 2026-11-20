import type { ApplicationRef } from '@angular/core';
import { makeFormState, makeRows, rowFieldNames, rowUpdate, seededRandom, type PlainRow } from '../../../../scenarios/data.ts';
import { lastTurnMs } from '../../../../subjects/bench-flag.ts';
import { collectionSeed } from '../../../../subjects/seed.ts';
import type { SubjectTransaction, SubjectTree, TreeOptions, WriterContextLike } from '../../../../subjects/types.ts';
import type { BenchHost, Row } from './bench-host';
import { subject } from './subject';

/**
 * The page API the scenario driver calls through Playwright:
 * `await window.__bench.invoke(op, args)`. Every store call that a scenario
 * times goes through tree.turn(), which places one `signal-tree:` measure per
 * turn or batch in bench builds.
 */
export interface BenchPageApi {
  readonly subject: { readonly id: string; readonly capabilities: readonly string[] };
  invoke(op: string, args?: Record<string, unknown>): Promise<unknown>;
}

const USER: WriterContextLike = { writer: 'user', origin: 'user' };
const AGENT: WriterContextLike = { writer: 'agent:planner', origin: 'agent' };
const COLLECTION_KEY = 'grid';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/**
 * Runs `fn` from a task of the page's own (a posted message), not from the
 * task Playwright's evaluate runs in. Long animation frames do not count work
 * in that DevTools-protocol task as a task: a long first chunk that yields
 * before anything asks for a render is never reported (issue #75).
 */
function inPageTask<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      fn().then(resolve, reject);
    };
    channel.port2.postMessage(0);
  });
}

function need<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`subject ${subject.id} lacks ${name}`);
  return value;
}

/** The agent batch: `fieldEdits` edits spread evenly over `rows` rows starting at `firstRow`. */
function planAgentBatch(fieldEdits: number, rows: number, firstRow: number, fields: number, seed: number) {
  const random = seededRandom(seed);
  const perRow = Math.ceil(fieldEdits / rows);
  const names = rowFieldNames(fields).slice(1);
  const plan: { id: number; changes: Record<string, number | string> }[] = [];
  let left = fieldEdits;
  for (let r = 0; r < rows && left > 0; r++) {
    const changes: Record<string, number | string> = {};
    for (let e = 0; e < perRow && left > 0; e++, left--) {
      const name = names[(r + e) % names.length]!;
      const n = Math.floor(random() * 100000);
      changes[name] = Number(name.slice(1)) % 2 === 1 ? n : `a${n}`;
    }
    plan.push({ id: firstRow + r, changes });
  }
  return plan;
}

export function installBenchApi(host: BenchHost, appRef: ApplicationRef): void {
  let pendingRows: PlainRow[] | undefined;
  let soak: { stop(): void; runUntil(writes: number): Promise<void>; status(): Record<string, unknown> } | undefined;

  const settle = async () => {
    await appRef.whenStable();
    await nextFrame();
  };

  const tree = (): SubjectTree => need(host.tree, 'a mounted tree');
  const collection = () => need(host.collection, 'a mounted collection');

  const applyPlan = (plan: ReturnType<typeof planAgentBatch>) => {
    const rows = collection();
    for (const edit of plan) rows.updateOne(edit.id, edit.changes as Partial<Row>);
  };

  const ops: Record<string, (args: Record<string, unknown>) => unknown> = {
    async 'mount.form'(args) {
      const { state, paths } = makeFormState(args['fields'] as number, args['perSection'] as number);
      const t = subject.createTree(state, { variant: args['variant'] as TreeOptions['variant'] });
      host.tree = t;
      host.form.set(paths.map((path, i) => ({ id: `f${i}`, leaf: t.leaf<string>(path) })));
      host.view.set('form');
      await settle();
      return { fields: paths.length };
    },

    'mount.collection'(args) {
      const t = subject.createTree({ [COLLECTION_KEY]: collectionSeed('id') }, {
        variant: args['variant'] as TreeOptions['variant'],
        plugins: args['plugins'] as TreeOptions['plugins'],
      });
      host.tree = t;
      host.collection = t.collection<Row, number>([COLLECTION_KEY]);
      return {};
    },

    'collection.generate'(args) {
      pendingRows = makeRows(args['rows'] as number, args['fields'] as number);
      return { rows: pendingRows.length };
    },

    'collection.load'() {
      const rows = need(pendingRows, 'generated rows');
      tree().turn('collection.setAll', () => collection().setAll(rows as Row[]));
      // Release the page's own reference: from here only the store holds the rows (S2's heap overhead).
      pendingRows = undefined;
      return { setAllMs: lastTurnMs('collection.setAll'), count: collection().count(), harnessHoldsRows: pendingRows !== undefined };
    },

    async 'collection.render'(args) {
      const rendered = args['rendered'] as number;
      const names = rowFieldNames(args['fields'] as number);
      const rows = collection();
      const grid = [];
      for (let id = 0; id < rendered; id++) grid.push({ id, cells: names.map((name) => rows.field(id, name)) });
      host.grid.set(grid);
      host.view.set('grid');
      await settle();
      return { rendered: grid.length };
    },

    async 'collection.unrender'() {
      host.view.set('none');
      host.grid.set([]);
      await settle();
      return {};
    },

    /** S2 traffic: batch k is its own task, due at start + (k + 1) × batchEveryMs. */
    'collection.stream'(args) {
      const perBatch = Math.round(((args['rowUpdatesPerSecond'] as number) * (args['batchEveryMs'] as number)) / 1000);
      const batches = Math.round((args['durationMs'] as number) / (args['batchEveryMs'] as number));
      const batchEveryMs = args['batchEveryMs'] as number;
      const fieldsPerUpdate = args['fieldsPerUpdate'] as number;
      const rowCount = args['rows'] as number;
      const random = seededRandom(args['seed'] as number);
      const t = tree();
      const rows = collection();
      const start = performance.now();
      let maxLateMs = 0;
      return new Promise((resolve) => {
        const run = (k: number) => {
          maxLateMs = Math.max(maxLateMs, performance.now() - (start + (k + 1) * batchEveryMs));
          const ids: number[] = [];
          const changes: Record<string, number | string>[] = [];
          for (let u = 0; u < perBatch; u++) {
            ids.push(Math.floor(random() * rowCount));
            changes.push(rowUpdate(random, fieldsPerUpdate));
          }
          t.turn('S2.batch', () => {
            for (let u = 0; u < perBatch; u++) rows.updateOne(ids[u]!, changes[u] as Partial<Row>);
          });
          if (k + 1 < batches) schedule(k + 1);
          else resolve({ batches, rowUpdates: batches * perBatch, startMs: start, endMs: performance.now(), maxLateMs });
        };
        const schedule = (k: number) => setTimeout(() => run(k), Math.max(0, start + (k + 1) * batchEveryMs - performance.now()));
        schedule(0);
      });
    },

    /**
     * S3: chunked bulk replace; resolves with the total wall time. The rows
     * are made here; the replace starts in a page task, so its first chunk
     * is a task the long animation frames see.
     */
    async 'collection.setAllChunked'(args) {
      const rows = makeRows(args['rows'] as number, args['fields'] as number, 1);
      const chunked = need(collection().setAllChunked, 'chunkedSetAll');
      return inPageTask(async () => {
        const start = performance.now();
        await chunked.call(collection(), rows as Row[]);
        return { totalMs: performance.now() - start, count: collection().count() };
      });
    },

    /** S4a: agent batch in a transaction, then inspect() and rollback(). */
    'agent.transaction'(args) {
      const t = tree();
      const plan = planAgentBatch(args['fieldEdits'] as number, args['rows'] as number, 0, args['fields'] as number, args['seed'] as number);
      need(t.as, 'writers');
      need(t.transact, 'transactions');
      let tx: SubjectTransaction | undefined;
      t.turn('S4a.apply', () => {
        tx = t.as!(AGENT, () => t.transact!(() => applyPlan(plan)));
      });
      t.turn('S4a.inspect', () => void tx!.inspect());
      t.turn('S4a.rollback', () => tx!.rollback());
      return { agentApplyMs: lastTurnMs('S4a.apply'), inspectMs: lastTurnMs('S4a.inspect'), rollbackMs: lastTurnMs('S4a.rollback') };
    },

    /** S4b: a user edit and an agent batch, both undoable, then undo({ writer: agent }). */
    'agent.selectiveUndo'(args) {
      const t = tree();
      const plan = planAgentBatch(args['fieldEdits'] as number, args['rows'] as number, 0, args['fields'] as number, args['seed'] as number);
      const as = need(t.as, 'writers');
      const undoable = need(t.undoable, 'restoration');
      const undo = need(t.undo, 'selectiveUndo');
      const userRow = (args['rows'] as number) + 1;
      as.call(t, USER, () => undoable.call(t, () => collection().updateOne(userRow, { f1: 424242 } as Partial<Row>)));
      as.call(t, AGENT, () => undoable.call(t, () => applyPlan(plan)));
      t.turn('S4b.undo', () => undo.call(t, { writer: AGENT.writer }));
      const userKept = collection().field(userRow, 'f1')() === 424242;
      return { selectiveUndoMs: lastTurnMs('S4b.undo'), userEditKept: userKept };
    },

    /** S4c: hold the user's field and show it as an input the driver types into. */
    async 'held.mount'(args) {
      const t = tree();
      const id = args['row'] as number;
      const field = args['field'] as string;
      const hold = need(t.hold, 'hold');
      const cell = need(collection().writableField, 'collectionFieldWrite').call(collection(), id, field);
      const release = hold.call(t, [COLLECTION_KEY, String(id), field], USER);
      const input = document.createElement('input');
      input.id = 'held';
      input.value = String(cell());
      input.addEventListener('input', () => {
        const value = input.value;
        need(t.as, 'writers').call(t, USER, () => t.turn('S4c.keystroke', () => cell.set(value as never)));
      });
      document.body.prepend(input);
      (window as unknown as { __benchHeld?: unknown }).__benchHeld = { cell, release, input };
      await settle();
      return {};
    },

    /** S4c: apply one agent batch that includes the held field; report whether the held value survived. */
    'held.agentBatch'(args) {
      const t = tree();
      const held = (window as unknown as { __benchHeld: { cell: () => unknown; input: HTMLInputElement } }).__benchHeld;
      const plan = planAgentBatch(args['fieldEdits'] as number, args['rows'] as number, args['row'] as number, args['fields'] as number, args['seed'] as number);
      plan[0]!.changes[args['field'] as string] = 'agent-overwrite';
      const as = need(t.as, 'writers');
      const typed = held.input.value;
      let refusals = 0;
      t.turn('S4c.agent', () => {
        as.call(t, AGENT, () => {
          for (const edit of plan) {
            try {
              collection().updateOne(edit.id, edit.changes as Partial<Row>);
            } catch {
              refusals++;
            }
          }
        });
      });
      return { overwritten: held.cell() !== typed, refusals };
    },

    /**
     * S5: S2 + S4 traffic. Full mode ticks every batchEveryMs of real time until
     * stopped; compressed mode ticks only inside soak.runUntil, back to back, so
     * the driver can sample the heap at exact write counts.
     */
    'soak.start'(args) {
      const t = tree();
      const random = seededRandom(args['seed'] as number);
      const rowCount = args['rows'] as number;
      const fieldsPerUpdate = args['fieldsPerUpdate'] as number;
      const perBatch = Math.round(((args['rowUpdatesPerSecond'] as number) * (args['batchEveryMs'] as number)) / 1000);
      const as = need(t.as, 'writers');
      need(t.transact, 'transactions');
      let writes = 0;
      let stopped = false;
      let ticks = 0;
      const tick = () => {
        const ids: number[] = [];
        const changes: Record<string, number | string>[] = [];
        for (let u = 0; u < perBatch; u++) {
          ids.push(Math.floor(random() * rowCount));
          changes.push(rowUpdate(random, fieldsPerUpdate));
        }
        t.turn('S5.server', () =>
          as.call(t, { writer: 'sync:server', origin: 'server' }, () => {
            for (let u = 0; u < perBatch; u++) collection().updateOne(ids[u]!, changes[u] as Partial<Row>);
          }),
        );
        writes += perBatch * fieldsPerUpdate;
        as.call(t, USER, () => t.turn('S5.user', () => collection().updateOne(rowCount - 1, { f2: `u${ticks}` } as Partial<Row>)));
        writes += 1;
        if (ticks % 50 === 0) {
          const first = Math.floor(random() * Math.max(1, rowCount - (args['agentRows'] as number)));
          const plan = planAgentBatch(args['fieldEdits'] as number, args['agentRows'] as number, first, args['fields'] as number, ticks);
          const pending = t.as!(AGENT, () => t.transact!(() => applyPlan(plan)));
          if (ticks % 100 === 0) pending.rollback();
          else pending.confirm();
          writes += args['fieldEdits'] as number;
          if (t.undo && ticks % 150 === 0) t.undo({ writer: AGENT.writer });
        }
        ticks++;
      };
      if (args['compressed'] !== true) {
        const loop = () => {
          if (stopped) return;
          tick();
          setTimeout(loop, args['batchEveryMs'] as number);
        };
        loop();
      }
      soak = {
        stop: () => {
          stopped = true;
        },
        async runUntil(target: number) {
          while (!stopped && writes < target) {
            tick();
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        },
        status: () => ({ writes, ticks, collections: t.pluginCollections ? t.pluginCollections() : [] }),
      };
      return {};
    },
    async 'soak.runUntil'(args) {
      await need(soak, 'a running soak').runUntil(args['writes'] as number);
      return need(soak, 'a running soak').status();
    },
    'soak.status'() {
      return need(soak, 'a running soak').status();
    },
    'soak.stop'() {
      need(soak, 'a running soak').stop();
      return need(soak, 'a running soak').status();
    },

    async unmount() {
      host.view.set('none');
      host.form.set([]);
      host.grid.set([]);
      host.tree?.destroy();
      host.tree = undefined;
      host.collection = undefined;
      soak?.stop();
      soak = undefined;
      await settle();
      return {};
    },
  };

  const api: BenchPageApi = {
    subject: { id: subject.id, capabilities: [...subject.capabilities] },
    async invoke(op, args = {}) {
      const handler = ops[op];
      if (!handler) throw new Error(`unknown bench op ${op}`);
      return await handler(args);
    },
  };
  (window as unknown as { __bench: BenchPageApi }).__bench = api;
}
