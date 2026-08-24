import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { timeTravel } from './restoration';
import { transactions } from '../transactions/transactions';

/**
 * HIST-C2 — the ten pre-registered door cases.
 *
 * Written against the temporary `restorationEligibility: 'designated'` switch;
 * that switch is gone and opt-in is simply the default, so the cases now run
 * against the shipped semantics unchanged.
 *
 * `withRestorationDesignation` stands in for whatever the public spelling turns
 * out to be (`undoable(...)`, `tree.undoable(...)`, …). The name is NOT the
 * experiment; whether synchronous designation correctly reaches the confirmed
 * causal turn is.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/**
 * Typed builders rather than one generic helper with `as never`. An earlier
 * spec in this audit used `as never` on the enhancer array and it silently
 * erased the enhancer type additions — `getHistory`/`undo` vanished from the
 * result type and `check-spec-types` caught it. Spelling each tree out keeps
 * the enhancer methods on the inferred type.
 */
const ttDesignated = () =>
  timeTravel({ maxHistorySize: 50 });

const makeTree = () =>
  signalTree(
    {
      document: { title: 'v1', body: 'b1' },
      ui: { panel: 'none' },
    },
    { enhancers: [ttDesignated()] }
  );

const makeRowsTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [ttDesignated()] }
  );

/** History length excluding the INIT baseline, which is not an authored turn. */
const turns = (tree: { getHistory(): readonly unknown[] }) =>
  tree.getHistory().length - 1;

describe('HIST-C2 door: turn-level eligibility', () => {
  it('1. an ordinary UNMARKED write records nothing', async () => {
    const tree = makeTree();
    await flush();

    tree.$.document.title.set('edited');
    await flush();

    expect(turns(tree)).toBe(0);
    expect(tree.$.document.title()).toBe('edited'); // the write still happened
    expect(tree.canUndo()).toBe(false);
  });

  it('2. one MARKED write records exactly one turn, and undo works', async () => {
    const tree = makeTree();
    await flush();

    undoable(() => tree.$.document.title.set('edited'));
    await flush();

    expect(turns(tree)).toBe(1);
    expect(tree.canUndo()).toBe(true);

    tree.undo();
    await flush();
    expect(tree.$.document.title()).toBe('v1');
  });

  it('3. several marked writes in one turn record ONE atomic entry', async () => {
    const tree = makeTree();
    await flush();

    undoable(() => {
      tree.$.document.title.set('t');
      tree.$.document.body.set('b');
      tree.$.ui.panel.set('inspector');
    });
    await flush();

    expect(turns(tree)).toBe(1);

    tree.undo();
    await flush();
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.document.body()).toBe('b1');
    expect(tree.$.ui.panel()).toBe('none');
  });

  it('4. THE ATOMICITY CASE — marked + unmarked in one turn: the WHOLE turn reverses', async () => {
    const tree = makeTree();
    await flush();

    // One tick, therefore one causal turn. The designation is inside; the
    // second write is outside it but inside the same turn.
    undoable(() => tree.$.document.title.set('edited'));
    tree.$.ui.panel.set('inspector');
    await flush();

    expect(turns(tree)).toBe(1);

    tree.undo();
    await flush();

    // THE REQUIRED RESULT. One designated write promotes the turn, and the turn
    // reverses whole. Anything else would partially reverse an atomic operation
    // — the HIST-B failure, reintroduced through the door instead of through
    // location filtering.
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.ui.panel()).toBe('none');
  });

  it('5. two independent marked scopes in ONE tick — does a scope bound an operation?', async () => {
    const tree = signalTree({ a: 1, b: 2 }, { enhancers: [ttDesignated()] });
    await flush();

    undoable(() => tree.$.a.set(10));
    undoable(() => tree.$.b.set(20));
    await flush();

    // THE FINDING, recorded rather than preferred: the scope is an ELIGIBILITY
    // scope, not an operation boundary. Same tick means one causal turn, so two
    // scopes collapse into one undo step. Whether applications need them
    // separate is the open requirement — the tick boundary that ordinary UI
    // events provide may already be enough.
    expect(turns(tree)).toBe(1);

    tree.undo();
    await flush();
    expect(tree.$.a()).toBe(1);
    expect(tree.$.b()).toBe(2);
  });

  it('6. a transaction INSIDE a marked scope is one reversible transaction', async () => {
    const tree = signalTree(
      { document: { title: 'v1' }, ui: { panel: 'none' } },
      { enhancers: [ttDesignated(), transactions()] }
    );
    await flush();

    undoable(() => {
      tree
        .transaction(() => {
          tree.$.document.title.set('edited');
          tree.$.ui.panel.set('inspector');
        })
        .confirm();
    });
    await flush();

    expect(turns(tree)).toBe(1);

    tree.undo();
    await flush();
    expect(tree.$.document.title()).toBe('v1');
  });

  it('7. an UNMARKED transaction records nothing', async () => {
    const tree = signalTree(
      { document: { title: 'v1' } },
      { enhancers: [ttDesignated(), transactions()] }
    );
    await flush();

    tree
      .transaction(() => {
        tree.$.document.title.set('edited');
      })
      .confirm();
    await flush();

    // The transaction still COMMITTED — eligibility governs restoration, never
    // whether the write lands.
    expect(turns(tree)).toBe(0);
    expect(tree.$.document.title()).toBe('edited');
  });

  it('8. a realization inside a marked scope stays NON-historical', async () => {
    const tree = makeTree();
    await flush();

    undoable(() => {
      withWriteContext({ intent: 'system', participation: 'realized' }, () => {
        tree.$.document.title.set('from-server');
      });
    });
    await flush();

    // Rule 4. Designation must not be able to promote external truth into
    // restoration history — realization outranks the door.
    expect(turns(tree)).toBe(0);
    expect(tree.$.document.title()).toBe('from-server');
  });

  it('9. restoration inside a marked scope generates no new history', async () => {
    const tree = makeTree();
    await flush();

    undoable(() => tree.$.document.title.set('edited'));
    await flush();
    expect(turns(tree)).toBe(1);

    undoable(() => tree.undo());
    await flush();

    // Rule 5. An undo performed inside a designation scope must not record a
    // turn of its own, or undo would grow history without bound.
    expect(turns(tree)).toBe(1);
    expect(tree.$.document.title()).toBe('v1');
  });

  it('10. nested marked scopes are idempotent', async () => {
    const tree = makeTree();
    await flush();

    undoable(() => {
      undoable(() => {
        tree.$.document.title.set('inner');
      });
      tree.$.document.body.set('outer');
    });
    await flush();

    expect(turns(tree)).toBe(1);

    tree.undo();
    await flush();
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.document.body()).toBe('b1');
  });
});

describe('HIST-C2 door: the cost claim and the async contract', () => {
  it('a non-eligible turn acquires NO restoration claims', async () => {
    const tree = makeRowsTree();
    const claims = getSubjectRestorationClaims(tree);

    for (let g = 0; g < 40; g++) {
      tree.$.rows.setAll([{ id: `g${g}`, name: 'n' }]);
      await flush();
    }

    // The HIST-C payoff: ordinary authored churn now costs what realization
    // churn already cost — nothing. Same measurement shape as case 9.
    expect(turns(tree)).toBe(0);
    expect(claims?.snapshot().owners ?? 0).toBe(0);
    expect(claims?.snapshot().claimedSubjects ?? 0).toBe(0);
    expect(tree.$.rows.ids()).toEqual(['g39']);
  });

  it('and a designated turn does acquire them', async () => {
    const tree = makeRowsTree();
    const claims = getSubjectRestorationClaims(tree);

    undoable(() => tree.$.rows.setAll([{ id: 'a', name: 'n' }]));
    await flush();

    // Control. Without this the zero above would prove nothing.
    expect(turns(tree)).toBe(1);
    expect(claims?.snapshot().owners ?? 0).toBeGreaterThan(0);
  });

  it('an async designation scope is REFUSED, not silently ignored', () => {
    const tree = makeTree();

    // PER-0's lesson made structural. The ambient bit cannot survive an await,
    // so an async callback would designate nothing at all — the failure mode
    // that produced four false signals earlier in this audit.
    expect(() =>
      undoable(async () => {
        await Promise.resolve();
        tree.$.document.title.set('never-designated');
      })
    ).toThrow(/ST1033/);
  });
});
