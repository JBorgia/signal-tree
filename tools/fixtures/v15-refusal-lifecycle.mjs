// Runs beside an installed @signal-tree/kernel package. No private source imports.
import assert from 'node:assert/strict';
import {
  signalTree,
  transactions,
  restoration,
  undoable,
  entityMap,
  external,
  link,
} from '@signal-tree/kernel';
import {
  confirmedTurnReader,
  observeWrites,
} from '@signal-tree/kernel/internals';
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};
const results = [];
const uncaught = [];
process.on('uncaughtException', (e) => uncaught.push(String(e)));
const logs = [];
console.error = (...args) => logs.push(args.map(String).join(' '));
async function check(name, run) {
  const cleanups = [],
    evidence = {};
  try {
    await run((fn) => cleanups.push(fn), evidence);
    results.push({ name, pass: true, evidence });
  } catch (e) {
    results.push({ name, pass: false, error: String(e), evidence });
  } finally {
    for (const fn of cleanups.reverse()) {
      try {
        fn();
      } catch (e) {
        results.push({
          name: name + ':cleanup',
          pass: false,
          error: String(e),
        });
      }
    }
  }
}
const settled = async (l) => {
  let timer;
  try {
    assert.equal(
      await Promise.race([
        l.settled().then(() => true),
        new Promise((r) => {
          timer = setTimeout(() => r(false), 500);
        }),
      ]),
      true,
      'Link settled'
    );
  } finally {
    clearTimeout(timer);
  }
};
for (const conflict of ['replacement', 'dependent-add'])
  for (const disposition of ['confirm', 'resolve-retry']) {
    await check(`${conflict}/${disposition}`, async (cleanup, evidence) => {
      const tree = signalTree(
        { x: 0, rows: entityMap({ selectId: (r) => r.id }) },
        {
          enhancers: [
            transactions({ history: { retain: 100 } }),
            restoration({ maxHistorySize: 10 }),
          ],
        }
      );
      cleanup(() => tree.destroy());
      const sent = [];
      const relation = link(tree.$.x, { set: (value) => sent.push(value) });
      cleanup(() => relation.dispose());
      if (conflict === 'replacement')
        tree.$.rows.addOne({ id: 'A', name: 'original' });
      await tick();
      sent.length = 0;
      const pending = tree.transaction(() =>
        undoable(() => {
          tree.$.x(1);
          if (conflict === 'replacement') tree.$.rows.removeOne('A');
          else tree.$.rows.addOne({ id: 'A', name: 'agent' });
        })
      );
      await tick();
      if (conflict === 'replacement')
        tree.$.rows.addOne({ id: 'A', name: 'replacement' });
      else tree.$.rows.updateOne('A', { name: 'later' });
      await tick();
      const history = () =>
        confirmedTurnReader(tree).readConfirmedTurns().turns;
      // Retention is explicitly enabled; the ordinary later write must be visible.
      assert.ok(history().length > 0, 'non-vacuous retained ordinary history');
      const ownsX = () =>
        history().filter((t) =>
          t.effects.some((e) => e.path === 'x' && e.after === 1)
        ).length;
      const snapshot = () => ({
        x: tree.$.x(),
        rows: tree.$.rows.all(),
        sent: [...sent],
        confirmedX: ownsX(),
        canUndo: tree.canUndo(),
      });
      const before = { x: tree.$.x(), rows: tree.$.rows.all() };
      const retainedBefore = history();
      evidence.before = snapshot();
      evidence.refusals = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        let failure;
        try {
          pending.rollback();
        } catch (e) {
          failure = e;
        }
        await tick();
        evidence.refusals.push({ kind: failure?.cause?.kind, ...snapshot() });
        // A re-occupied removal key refuses either way; its kind changed in
        // 15.4.4 (effect-validation-failed -> later-confirmed-dependency), and
        // the gate pins which version reports which (`REPLACEMENT_KINDS`).
        if (conflict === 'replacement')
          assert.ok(
            ['effect-validation-failed', 'later-confirmed-dependency'].includes(
              failure?.cause?.kind
            ),
            `replacement refuses, got ${failure?.cause?.kind}`
          );
        else assert.equal(failure?.cause?.kind, 'later-confirmed-dependency');
        assert.deepEqual(
          { x: tree.$.x(), rows: tree.$.rows.all() },
          before,
          'refusal must not partially compensate'
        );
        assert.deepEqual(
          history(),
          retainedBefore,
          'refusal preserves every retained turn and effect'
        );
        assert.equal(
          ownsX(),
          0,
          'refusal must not confirm the pending contribution'
        );
        assert.equal(
          tree.canUndo(),
          false,
          'refusal must not enroll pending undo'
        );
      }
      if (disposition === 'confirm') {
        pending.confirm();
        await tick();
        assert.equal(
          ownsX(),
          1,
          'confirmation records exactly one contribution'
        );
        assert.equal(
          tree.canUndo(),
          true,
          'confirmation enrolls designated undo'
        );
        const state = snapshot();
        pending.confirm();
        await tick();
        assert.deepEqual(snapshot(), state, 'repeat confirm is inert');
        assert.throws(() => pending.rollback(), /confirmed/);
        assert.deepEqual(
          snapshot(),
          state,
          'terminal opposite settlement is inert'
        );
      } else {
        tree.$.rows.removeOne('A');
        await tick();
        const retryState = snapshot(),
          retryHistory = history();
        let retryFailure;
        try {
          pending.rollback();
        } catch (e) {
          retryFailure = e;
        }
        await tick();
        if (retryFailure) {
          assert.equal(conflict, 'dependent-add');
          assert.equal(retryFailure.cause?.kind, 'later-confirmed-dependency');
          assert.deepEqual(
            snapshot(),
            retryState,
            'third refusal changes no state, undo or endpoint'
          );
          assert.deepEqual(
            history(),
            retryHistory,
            'third refusal preserves retained history'
          );
          pending.confirm();
          await tick();
          assert.equal(ownsX(), 1);
          assert.equal(tree.canUndo(), true);
          const confirmed = snapshot();
          pending.confirm();
          await tick();
          assert.deepEqual(snapshot(), confirmed);
          assert.throws(() => pending.rollback());
          assert.deepEqual(snapshot(), confirmed);
          await settled(relation);
          assert.equal(sent.at(-1), tree.$.x());
          evidence.remainingRefusal = {
            kind: retryFailure.cause.kind,
            safetyVerified: true,
            final: snapshot(),
          };
          assert.fail(
            'conservative confirmed dependency still refuses after later removal'
          );
        }

        assert.equal(tree.$.x(), 0, 'retry actually reverses scalar');
        assert.deepEqual(
          tree.$.rows.all(),
          conflict === 'replacement' ? [{ id: 'A', name: 'original' }] : []
        );
        assert.equal(ownsX(), 0, 'rejection creates no confirmed contribution');
        assert.equal(tree.canUndo(), false, 'rejection creates no undo entry');
        const state = snapshot();
        pending.rollback();
        await tick();
        assert.deepEqual(snapshot(), state, 'repeat rollback is inert');
        assert.throws(() => pending.confirm(), /rolled back|rejected/);
        assert.deepEqual(
          snapshot(),
          state,
          'terminal opposite settlement is inert'
        );
      }
      await settled(relation);
      evidence.final = snapshot();
      assert.equal(
        sent.at(-1),
        tree.$.x(),
        'durable endpoint matches final truth'
      );
    });
  }
await check(
  'planner-pending-overlap-resolve-retry',
  async (cleanup, evidence) => {
    const t = signalTree(
      { x: 0, y: 0 },
      {
        enhancers: [
          transactions({ history: { retain: 100 } }),
          restoration({ maxHistorySize: 10 }),
        ],
      }
    );
    cleanup(() => t.destroy());
    const sent = [];
    const l = link(t.$.x, { set: (v) => sent.push(v) });
    cleanup(() => l.dispose());
    await tick();
    const p1 = t.transaction(() =>
      undoable(() => {
        t.$.x(1);
        t.$.y(1);
      })
    );
    await tick();
    const p2 = t.transaction(() => t.$.x(2));
    await tick();
    evidence.refusals = [];
    for (let i = 0; i < 2; i++) {
      let failure;
      try {
        p1.rollback();
      } catch (e) {
        failure = e;
      }
      await tick();
      evidence.refusals.push({
        kind: failure?.cause?.kind,
        x: t.$.x(),
        y: t.$.y(),
      });
      assert.equal(failure?.cause?.kind, 'later-pending-dependency');
      assert.equal(t.$.x(), 2);
      assert.equal(t.$.y(), 1);
      assert.equal(t.canUndo(), false);
    }
    p2.rollback();
    await tick();
    assert.equal(t.$.x(), 1);
    p1.rollback();
    await tick();
    evidence.final = {
      x: t.$.x(),
      y: t.$.y(),
      sent: [...sent],
      canUndo: t.canUndo(),
    };
    assert.equal(t.$.x(), 0);
    assert.equal(t.$.y(), 0);
    assert.equal(sent.at(-1), 0);
    assert.equal(t.canUndo(), false);
    await settled(l);
    const before = [...sent];
    p1.rollback();
    await tick();
    assert.deepEqual(sent, before);
    assert.throws(() => p1.confirm());
  }
);
await check('two-links-confirm', async (cleanup, evidence) => {
  const t = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
  cleanup(() => t.destroy());
  const xs = [],
    ys = [];
  const x = link(t.$.x, { set: (v) => xs.push(v) }),
    y = link(t.$.y, { set: (v) => ys.push(v) });
  cleanup(() => x.dispose());
  cleanup(() => y.dispose());
  await tick();
  xs.length = ys.length = 0;
  t.transaction(() => {
    t.$.x(1);
    t.$.y(2);
  }).confirm();
  await tick();
  evidence.sent = { xs, ys };
  await settled(x);
  await settled(y);
  assert.equal(xs.at(-1), 1);
  assert.equal(ys.at(-1), 2);
});
await check(
  'throwing-observer-handle-and-later-link',
  async (cleanup, evidence) => {
    const t = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    cleanup(() => t.destroy());
    const sent = [];
    const l = link(t.$.y, { set: (v) => sent.push(v) });
    cleanup(() => l.dispose());
    await tick();
    let armed = true;
    const off = observeWrites(() => {
      if (armed) {
        armed = false;
        throw Error('probe-observer');
      }
    });
    cleanup(off);
    let pending, failure;
    try {
      pending = t.transaction(() => t.$.x(1));
    } catch (e) {
      failure = e;
    }
    off();
    evidence.returned = !!pending;
    evidence.failure = String(failure);
    pending?.confirm();
    t.$.y(7);
    await tick();
    evidence.sent = sent;
    assert.ok(pending, 'transaction must return its handle');
    await settled(l);
    assert.equal(sent.at(-1), 7);
  }
);
await check(
  'confirmed-transaction-undo-redo-link',
  async (cleanup, evidence) => {
    const t = signalTree(
      { x: 0 },
      { enhancers: [transactions(), restoration({ maxHistorySize: 10 })] }
    );
    cleanup(() => t.destroy());
    const sent = [];
    const l = link(t.$.x, { set: (v) => sent.push(v) });
    cleanup(() => l.dispose());
    await tick();
    t.transaction(() => undoable(() => t.$.x(1))).confirm();
    await tick();
    t.undo();
    await tick();
    evidence.afterUndo = { x: t.$.x(), sent: [...sent] };
    assert.equal(sent.at(-1), 0);
    t.redo();
    await tick();
    evidence.afterRedo = { x: t.$.x(), sent: [...sent] };
    assert.equal(sent.at(-1), 1);
    await settled(l);
  }
);
// The automatic-refusal policy is observable without private fault injection.
await check(
  'automatic-refusal-history-before-link',
  async (cleanup, evidence) => {
    const tree = signalTree(
      { x: 0, rows: entityMap({ selectId: (row) => row.id }) },
      { enhancers: [transactions({ history: { retain: 100 } }), restoration()] }
    );
    cleanup(() => tree.destroy());
    tree.$.rows.addOne({ id: 'A', name: 'original' });
    await tick();
    const sent = [];
    const relation = link(tree.$.x, {
      set: (value) => sent.push({ value, canUndo: tree.canUndo() }),
    });
    cleanup(() => relation.dispose());
    await tick();
    sent.length = 0;
    const original = new Error('original callback');
    let caught, handle;
    try {
      undoable(() => {
        handle = tree.transaction(() => {
          tree.$.x(1);
          tree.$.rows.removeOne('A');
          external(() => tree.$.rows.addOne({ id: 'A', name: 'replacement' }));
          throw original;
        });
      });
    } catch (error) {
      caught = error;
    }
    await tick();
    const turns = confirmedTurnReader(tree).readConfirmedTurns().turns;
    evidence.result = {
      hasHandle: !!handle,
      kind: caught?.cause?.kind,
      callbackPreserved: caught?.cause?.callbackError === original,
      x: tree.$.x(),
      rows: tree.$.rows.all(),
      sent,
      confirmedX: turns.filter((turn) =>
        turn.effects.some((effect) => effect.path === 'x' && effect.after === 1)
      ).length,
      canUndo: tree.canUndo(),
    };
    assert.ok(turns.length > 0, 'history retention is not vacuous');
    assert.equal(handle, undefined);
    assert.equal(caught?.cause?.kind, 'effect-validation-failed');
    assert.equal(caught?.cause?.callbackError, original);
    assert.equal(tree.$.x(), 1);
    assert.deepEqual(tree.$.rows.all(), [{ id: 'A', name: 'replacement' }]);
    assert.equal(
      evidence.result.confirmedX,
      1,
      'surviving automatic-refusal contribution is committed'
    );
    assert.equal(tree.canUndo(), true);
    await settled(relation);
    assert.deepEqual(
      sent,
      [{ value: 1, canUndo: true }],
      'undo designation precedes released persistence'
    );
  }
);
// Diagnostic only: an existing documented failure is not counted as a pass.
await check('restored-entity-link', async (cleanup, evidence) => {
  const t = signalTree(
    { rows: entityMap({ selectId: (r) => r.id }) },
    { enhancers: [transactions()] }
  );
  cleanup(() => t.destroy());
  t.$.rows.addOne({ id: 'A', name: 'original' });
  await tick();
  const sent = [];
  const l = link(t.$.rows, { set: (v) => sent.push(v) });
  cleanup(() => l.dispose());
  await tick();
  const p = t.transaction(() => t.$.rows.removeOne('A'));
  await tick();
  p.rollback();
  await tick();
  evidence.state = t.$.rows.all();
  evidence.sent = sent;
  assert.deepEqual(sent.at(-1), evidence.state);
});
console.log(
  JSON.stringify({ results, uncaught, reportedErrors: logs.length }, null, 2)
);
process.exitCode = results.some((r) => !r.pass) || uncaught.length ? 1 : 0;
