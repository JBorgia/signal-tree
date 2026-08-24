import type { PositionId, ReversalEffect } from './causal-types';
import { AppliedTurnProjection } from './applied-turn-projection';
import { rollbackPendingTurnAt } from './pending-rollback';
import { createPositionRegistry } from '../position-registry';
import { createRealizationContextSource } from './realization-context';
import { TurnStore } from './turn-store';

const P_ROOT = 1 as PositionId;
const P_PROFILE = 2 as PositionId;
const P_DRIVER_KEY = 3 as PositionId;
const P_DRIVER_NAME = 4 as PositionId;
const P_SETTINGS = 5 as PositionId;
const P_THEME = 6 as PositionId;
const P_DRIVER_ENABLED = 7 as PositionId;
const P_DRIVER_LOCAL = 8 as PositionId;
const SUBJECT_DRIVER = 'driver-1';
const SUBJECT_OTHER_DRIVER = 'driver-2';

describe('structural pending rollback production composition', () => {
  it('compensates a pending rekey while preserving later same-subject scalar work', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);
    const driverName = topology.allocate(profile);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);
    expect(driverName).toBe(P_DRIVER_NAME);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues: new Map([
        [P_DRIVER_KEY, 'A'],
        [P_DRIVER_NAME, 'Alice'],
      ]),
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: 'B',
          subjectId: SUBJECT_DRIVER,
          structural: 'rekey',
        },
      ],
    });
    const confirmed = store.admitConfirmed({
      id: 2,
      effects: [
        {
          owner: P_DRIVER_NAME,
          before: 'Alice',
          after: 'Alicia',
          subjectId: SUBJECT_DRIVER,
        },
      ],
    });
    expect(appliedTurns.admitConfirmed(confirmed.id)).toEqual({ ok: true });

    const values = new Map<PositionId, unknown>([
      [P_DRIVER_KEY, 'B'],
      [P_DRIVER_NAME, 'Alicia'],
    ]);
    const appliedEffects: Array<
      Array<
        ReversalEffect & {
          readonly structural?: 'add' | 'remove' | 'rekey';
          readonly subjectId?: unknown;
        }
      >
    > = [];
    const port = {
      applyAtomically(effects: readonly ReversalEffect[]) {
        const staged = new Map(values);

        for (const effect of effects) {
          expect(staged.get(effect.owner)).toEqual(effect.before);
          staged.set(effect.owner, effect.after);
        }

        appliedEffects.push(
          effects.map((effect) => ({
            ...effect,
            structural: (effect as ReversalEffect & { structural?: 'add' | 'remove' | 'rekey' })
              .structural,
            subjectId: (effect as ReversalEffect & { subjectId?: unknown }).subjectId,
          }))
        );

        values.clear();
        for (const [positionId, value] of staged) {
          values.set(positionId, value);
        }
      },
    };

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port,
        realizationContext,
      })
    ).toEqual({ ok: true, turnId: pending.id });

    expect(appliedEffects).toEqual([
      [
        {
          owner: P_DRIVER_KEY,
          before: 'B',
          after: 'A',
          structural: 'rekey',
          subjectId: SUBJECT_DRIVER,
        },
      ],
    ]);
    expect(values.get(P_DRIVER_KEY)).toBe('A');
    expect(values.get(P_DRIVER_NAME)).toBe('Alicia');
    expect(store.hasPendingTurn(pending.id)).toBe(false);
    expect(store.getTurn(confirmed.id)).toEqual({
      id: confirmed.id,
      effects: [
        {
          owner: P_DRIVER_NAME,
          before: 'Alice',
          after: 'Alicia',
          subjectId: SUBJECT_DRIVER,
        },
      ],
      participants: [P_DRIVER_NAME],
      state: 'confirmed',
    });
    expect(appliedTurns.inspect()).toEqual({
      appliedTurnIds: [2],
      redoTurnIds: [],
      frontiers: {
        [P_DRIVER_NAME]: 2,
      },
    });
  });

  it('refuses pending rekey rollback after later same-subject structural supersession', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues: new Map([[P_DRIVER_KEY, 'A']]),
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: 'B',
          subjectId: SUBJECT_DRIVER,
          structural: 'rekey',
        },
      ],
    });
    const confirmed = store.admitConfirmed({
      id: 2,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: 'B',
          after: 'C',
          subjectId: SUBJECT_DRIVER,
          structural: 'rekey',
        },
      ],
    });
    expect(appliedTurns.admitConfirmed(confirmed.id)).toEqual({ ok: true });

    const storeBefore = store.inspect();
    const pendingBefore = store.getPendingTurnIds();
    const appliedBefore = appliedTurns.inspect();
    const values = new Map<PositionId, unknown>([[P_DRIVER_KEY, 'C']]);
    const applyAtomically = vi.fn((effects: readonly ReversalEffect[]) => {
      for (const effect of effects) {
        values.set(effect.owner, effect.after);
      }
    });

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port: { applyAtomically },
        realizationContext,
      })
    ).toEqual({ ok: false, refusal: { kind: 'dependency-conflict' } });

    expect(applyAtomically).not.toHaveBeenCalled();
    expect(values.get(P_DRIVER_KEY)).toBe('C');
    expect(store.inspect()).toEqual(storeBefore);
    expect(store.getPendingTurnIds()).toEqual(pendingBefore);
    expect(appliedTurns.inspect()).toEqual(appliedBefore);
  });

  it('rolls back a pending add as one structural remove while preserving unrelated surviving work', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);
    const driverName = topology.allocate(profile);
    const settings = topology.allocate(root);
    const theme = topology.allocate(settings);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);
    expect(driverName).toBe(P_DRIVER_NAME);
    expect(settings).toBe(P_SETTINGS);
    expect(theme).toBe(P_THEME);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues: new Map([[P_THEME, 'light']]),
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: undefined,
          after: 'A',
          subjectId: SUBJECT_DRIVER,
          structural: 'add',
        },
      ],
    });
    const confirmed = store.admitConfirmed({
      id: 2,
      effects: [{ owner: P_THEME, before: 'light', after: 'dark' }],
    });
    expect(appliedTurns.admitConfirmed(confirmed.id)).toEqual({ ok: true });

    const values = new Map<PositionId, unknown>([
      [P_DRIVER_KEY, 'A'],
      [P_THEME, 'dark'],
    ]);
    const appliedEffects: Array<
      Array<
        ReversalEffect & {
          readonly structural?: 'add' | 'remove' | 'rekey';
          readonly subjectId?: unknown;
        }
      >
    > = [];
    const port = {
      applyAtomically(effects: readonly ReversalEffect[]) {
        const staged = new Map(values);

        for (const effect of effects) {
          expect(staged.get(effect.owner)).toEqual(effect.before);
          staged.set(effect.owner, effect.after);
        }

        appliedEffects.push(
          effects.map((effect) => ({
            ...effect,
            structural: (effect as ReversalEffect & { structural?: 'add' | 'remove' | 'rekey' })
              .structural,
            subjectId: (effect as ReversalEffect & { subjectId?: unknown }).subjectId,
          }))
        );

        values.clear();
        for (const [positionId, value] of staged) {
          values.set(positionId, value);
        }
      },
    };

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port,
        realizationContext,
      })
    ).toEqual({ ok: true, turnId: pending.id });

    expect(appliedEffects).toEqual([
      [
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: undefined,
          structural: 'remove',
          subjectId: SUBJECT_DRIVER,
        },
      ],
    ]);
    expect(values.get(P_DRIVER_KEY)).toBeUndefined();
    expect(values.get(P_THEME)).toBe('dark');
    expect(store.hasPendingTurn(pending.id)).toBe(false);
    expect(appliedTurns.inspect()).toEqual({
      appliedTurnIds: [2],
      redoTurnIds: [],
      frontiers: {
        [P_THEME]: 2,
      },
    });
  });

  it('nets same-turn add plus field writes to one structural remove', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);
    const driverName = topology.allocate(profile);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);
    expect(driverName).toBe(P_DRIVER_NAME);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: undefined,
          after: 'A',
          subjectId: SUBJECT_DRIVER,
          structural: 'add',
        },
        {
          owner: P_DRIVER_NAME,
          before: undefined,
          after: 'Alice',
          subjectId: SUBJECT_DRIVER,
        },
      ],
    });

    const values = new Map<PositionId, unknown>([
      [P_DRIVER_KEY, 'A'],
      [P_DRIVER_NAME, 'Alice'],
    ]);
    const appliedEffects: Array<
      Array<
        ReversalEffect & {
          readonly structural?: 'add' | 'remove' | 'rekey';
          readonly subjectId?: unknown;
        }
      >
    > = [];
    const port = {
      applyAtomically(effects: readonly ReversalEffect[]) {
        const staged = new Map(values);

        for (const effect of effects) {
          expect(staged.get(effect.owner)).toEqual(effect.before);
          staged.set(effect.owner, effect.after);
        }

        appliedEffects.push(
          effects.map((effect) => ({
            ...effect,
            structural: (effect as ReversalEffect & { structural?: 'add' | 'remove' | 'rekey' })
              .structural,
            subjectId: (effect as ReversalEffect & { subjectId?: unknown }).subjectId,
          }))
        );

        values.clear();
        for (const [positionId, value] of staged) {
          values.set(positionId, value);
        }
      },
    };

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port,
        realizationContext,
      })
    ).toEqual({ ok: true, turnId: pending.id });

    expect(appliedEffects).toEqual([
      [
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: undefined,
          structural: 'remove',
          subjectId: SUBJECT_DRIVER,
        },
      ],
    ]);
    expect(values.get(P_DRIVER_KEY)).toBeUndefined();
    expect(values.get(P_DRIVER_NAME)).toBe('Alice');
    expect(store.hasPendingTurn(pending.id)).toBe(false);
  });



  it('refuses pending remove rollback after later same-subject structural supersession', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues: new Map([[P_DRIVER_KEY, 'A']]),
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: undefined,
          subjectId: SUBJECT_DRIVER,
          structural: 'remove',
        },
      ],
    });
    const confirmed = store.admitConfirmed({
      id: 2,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: undefined,
          after: 'B',
          subjectId: SUBJECT_DRIVER,
          structural: 'add',
        },
      ],
    });
    expect(appliedTurns.admitConfirmed(confirmed.id)).toEqual({ ok: true });

    const storeBefore = store.inspect();
    const pendingBefore = store.getPendingTurnIds();
    const appliedBefore = appliedTurns.inspect();
    const values = new Map<PositionId, unknown>([[P_DRIVER_KEY, 'B']]);
    const applyAtomically = vi.fn<void, [readonly ReversalEffect[]]>();

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port: { applyAtomically },
        realizationContext,
      })
    ).toEqual({ ok: false, refusal: { kind: 'dependency-conflict' } });

    expect(applyAtomically).not.toHaveBeenCalled();
    expect(values.get(P_DRIVER_KEY)).toBe('B');
    expect(store.inspect()).toEqual(storeBefore);
    expect(store.getPendingTurnIds()).toEqual(pendingBefore);
    expect(appliedTurns.inspect()).toEqual(appliedBefore);
  });

  it('refuses pending remove rollback with structural-drift when uncaptured external occupancy blocks the planned restore', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);
    const driverName = topology.allocate(profile);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);
    expect(driverName).toBe(P_DRIVER_NAME);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues: new Map([
        [P_DRIVER_KEY, 'A'],
        [P_DRIVER_NAME, 'Alice'],
      ]),
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_NAME,
          before: 'Alice',
          after: undefined,
          subjectId: SUBJECT_DRIVER,
        },
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: undefined,
          subjectId: SUBJECT_DRIVER,
          structural: 'remove',
        },
      ],
    });

    const storeBefore = store.inspect();
    const pendingBefore = store.getPendingTurnIds();
    const appliedBefore = appliedTurns.inspect();
    const values = new Map<PositionId, unknown>([
      [P_DRIVER_KEY, 'U'],
      [P_DRIVER_NAME, 'Uma'],
    ]);
    const applyAtomically = vi.fn<void, [readonly ReversalEffect[]]>();

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port: {
          validateEffects: (effects) => {
            expect(effects).toEqual([
              {
                owner: P_DRIVER_KEY,
                before: undefined,
                after: 'A',
                structural: 'add',
                subjectId: SUBJECT_DRIVER,
              },
            ]);

            return { kind: 'structural-drift' };
          },
          applyAtomically,
        },
        realizationContext: createRealizationContextSource({
          baselineValues: new Map([
            [P_DRIVER_KEY, 'A'],
            [P_DRIVER_NAME, 'Alice'],
          ]),
          store,
          appliedTurns,
        }),
      })
    ).toEqual({ ok: false, refusal: { kind: 'structural-drift' } });

    expect(applyAtomically).not.toHaveBeenCalled();
    expect(values.get(P_DRIVER_KEY)).toBe('U');
    expect(values.get(P_DRIVER_NAME)).toBe('Uma');
    expect(store.inspect()).toEqual(storeBefore);
    expect(store.getPendingTurnIds()).toEqual(pendingBefore);
    expect(appliedTurns.inspect()).toEqual(appliedBefore);
  });

  it('refuses pending remove rollback with dependency-conflict when later captured add by a different subject occupies the released location', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);
    const driverName = topology.allocate(profile);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);
    expect(driverName).toBe(P_DRIVER_NAME);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues: new Map([
        [P_DRIVER_KEY, 'A'],
        [P_DRIVER_NAME, 'Alice'],
      ]),
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_NAME,
          before: 'Alice',
          after: undefined,
          subjectId: SUBJECT_DRIVER,
        },
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: undefined,
          subjectId: SUBJECT_DRIVER,
          structural: 'remove',
        },
      ],
    });
    const confirmed = store.admitConfirmed({
      id: 2,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: undefined,
          after: 'A',
          subjectId: SUBJECT_OTHER_DRIVER,
          structural: 'add',
        },
      ],
    });
    expect(appliedTurns.admitConfirmed(confirmed.id)).toEqual({ ok: true });

    const storeBefore = store.inspect();
    const pendingBefore = store.getPendingTurnIds();
    const appliedBefore = appliedTurns.inspect();
    const validateEffects = vi.fn();
    const applyAtomically = vi.fn<void, [readonly ReversalEffect[]]>();

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port: {
          validateEffects,
          applyAtomically,
        },
        realizationContext,
      })
    ).toEqual({ ok: false, refusal: { kind: 'dependency-conflict' } });

    expect(validateEffects).not.toHaveBeenCalled();
    expect(applyAtomically).not.toHaveBeenCalled();
    expect(store.inspect()).toEqual(storeBefore);
    expect(store.getPendingTurnIds()).toEqual(pendingBefore);
    expect(appliedTurns.inspect()).toEqual(appliedBefore);
  });

  it('refuses pending rekey rollback with dependency-conflict when later captured add by a different subject occupies the released location', () => {
    const topology = createPositionRegistry();
    const root = topology.allocate();
    const profile = topology.allocate(root);
    const driverKey = topology.allocate(profile);

    expect(root).toBe(P_ROOT);
    expect(profile).toBe(P_PROFILE);
    expect(driverKey).toBe(P_DRIVER_KEY);

    const store = new TurnStore();
    const appliedTurns = new AppliedTurnProjection(store);
    const realizationContext = createRealizationContextSource({
      baselineValues: new Map([[P_DRIVER_KEY, 'A']]),
      store,
      appliedTurns,
    });
    const pending = store.admitPending({
      id: 1,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: 'A',
          after: 'B',
          subjectId: SUBJECT_DRIVER,
          structural: 'rekey',
        },
      ],
    });
    store.admitPending({
      id: 2,
      effects: [
        {
          owner: P_DRIVER_KEY,
          before: undefined,
          after: 'A',
          subjectId: SUBJECT_OTHER_DRIVER,
          structural: 'add',
        },
      ],
    });

    const storeBefore = store.inspect();
    const pendingBefore = store.getPendingTurnIds();
    const appliedBefore = appliedTurns.inspect();
    const validateEffects = vi.fn();
    const applyAtomically = vi.fn<void, [readonly ReversalEffect[]]>();

    expect(
      rollbackPendingTurnAt({
        authority: P_PROFILE,
        turnId: pending.id,
        store,
        topology,
        port: {
          validateEffects,
          applyAtomically,
        },
        realizationContext,
      })
    ).toEqual({ ok: false, refusal: { kind: 'dependency-conflict' } });

    expect(validateEffects).not.toHaveBeenCalled();
    expect(applyAtomically).not.toHaveBeenCalled();
    expect(store.inspect()).toEqual(storeBefore);
    expect(store.getPendingTurnIds()).toEqual(pendingBefore);
    expect(appliedTurns.inspect()).toEqual(appliedBefore);
  });
});
