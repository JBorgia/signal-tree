import { describe, expect, it } from 'vitest';
import { AUTHORITY_CASES } from './semantics-authority';
import {
  UnsupportedSemantic,
  type AuthorityEvent,
  type Handle,
  type SettlementView,
} from './semantics-contract';
import {
  runSupplemental,
  supplementalExitCode,
  type Fixture,
} from './semantics-supplemental';

// Scripted returns test the instrument only. There is no canonical/overlay
// resolver here, and this fixture is never supplied to candidate evidence runs.
const scripts: Record<
  string,
  { visible: number[]; canonical: number[]; views?: SettlementView[] }
> = {
  A1: { visible: [1], canonical: [7] },
  A2: {
    visible: [1],
    canonical: [1],
    views: [{ disposition: 'committed', retainsAuthority: false }],
  },
  A3: {
    visible: [7],
    canonical: [7],
    views: [{ disposition: 'rejected', retainsAuthority: false }],
  },
  A4: { visible: [9, 9], canonical: [9, 9] },
  A5: { visible: [1], canonical: [7] },
  A6: { visible: [7], canonical: [7] },
  T18: { visible: [2, 10], canonical: [2, 10] },
  T19: { visible: [10, 10], canonical: [10, 10] },
  T20: {
    visible: [2],
    canonical: [1],
    views: [
      { disposition: 'committed', retainsAuthority: false },
      { disposition: 'pending', retainsAuthority: true },
    ],
  },
  T21: { visible: [2, 11, 11], canonical: [2, 11, 11] },
  T22: { visible: [], canonical: [0] },
};
function scripted(id: string) {
  const script = scripts[id.split('/')[0]];
  let v = 0,
    c = 0,
    s = 0,
    disposed = 0;
  const events: AuthorityEvent[] = [];
  const fixture: Fixture = {
    candidate: {
      beginContribution: (fn) => {
        fn();
        return {} as Handle;
      },
      settleAccept: () => ({ status: 'settled' }),
      settleReject: () => ({ status: 'settled' }),
      applyAuthority: (event) => {
        events.push(event);
      },
      readVisible: () => ({ x: 0, y: script.visible[v++], z: 0 }),
      readCanonical: () => ({ x: 0, y: script.canonical[c++], z: 0 }),
      readSettlementState: () =>
        script.views?.[s++] ?? {
          disposition: 'pending',
          retainsAuthority: true,
        },
      observeVisible: () => () => undefined,
    },
    write: () => undefined,
    flush: async () => undefined,
    dispose: () => {
      disposed++;
    },
    hasPendingAuthority: () => true,
    confirmedCount: () => 0,
  };
  return { fixture, events, disposed: () => disposed };
}
const execute = (id: string, alter?: (f: Fixture) => void) => {
  const test = AUTHORITY_CASES.find((row) => row.id.startsWith(id + '/'))!;
  const control = scripted(test.id);
  alter?.(control.fixture);
  return {
    control,
    result: runSupplemental(
      {
        scalar: async () => control.fixture,
        occupied: async () => control.fixture,
      },
      [test]
    ),
  };
};

describe('authority oracle instrument controls — not candidate conformance', () => {
  it.each(AUTHORITY_CASES.map((c) => c.id))(
    'reaches all preregistered assertions: %s',
    async (id) => {
      const { control, result } = execute(id.split('/')[0]);
      const rows = await result;
      expect(rows[0].status).toBe('held');
      expect(rows[0].assertions.length).toBeGreaterThan(0);
      expect(supplementalExitCode(rows)).toBe(0);
      expect(control.disposed()).toBe(1);
    }
  );
  it.each([
    'A1',
    'A2',
    'A3',
    'A4',
    'A5',
    'A6',
    'T18',
    'T19',
    'T20',
    'T21',
    'T22',
  ])('detects corrupt canonical evidence: %s', async (id) => {
    const { result } = execute(id, (f) => {
      f.candidate.readCanonical = () => ({ y: -999 });
    });
    expect((await result)[0].status).toBe('violated');
  });
  it('retains visible failure and pending assertions when canonical is unsupported', async () => {
    const { result } = execute('A1', (f) => {
      f.candidate.readVisible = () => ({ y: 7 });
      f.candidate.readCanonical = () => {
        throw new UnsupportedSemantic('no canonical reader');
      };
    });
    const [row] = await result;
    expect(row.status).toBe('violated');
    expect(row.assertions.map((a) => a.status)).toEqual([
      'violated',
      'held',
      'unsupported',
    ]);
  });
  it('distinguishes unsupported reads, unsupported ingress and unexpected operation errors', async () => {
    for (const [where, error, expected] of [
      ['reader', new UnsupportedSemantic('canonical absent'), 'unsupported'],
      ['ingress', new UnsupportedSemantic('revision absent'), 'unsupported'],
      ['ingress', new Error('broken operation'), 'error'],
    ] as const) {
      const { result } = execute('A1', (f) => {
        if (where === 'reader')
          f.candidate.readCanonical = () => {
            throw error;
          };
        else
          f.candidate.applyAuthority = () => {
            throw error;
          };
      });
      const rows = await result;
      expect(rows[0].status).toBe(expected);
      expect(supplementalExitCode(rows)).toBe(1);
    }
  });
  it('refused remaining included settlement is never counted as successful', async () => {
    const { result } = execute('A4', (f) => {
      f.candidate.settleAccept = () => ({
        status: 'refused',
        reason: 'control',
      });
    });
    const rows = await result;
    expect(rows[0].status).toBe('violated');
    expect(supplementalExitCode(rows)).toBe(1);
  });
  it('detects invented terminal settlement and retained authority after acceptance', async () => {
    for (const id of ['A1', 'A2', 'T22']) {
      const { result } = execute(id, (f) => {
        f.candidate.readSettlementState = () => ({
          disposition: 'committed',
          retainsAuthority: true,
        });
      });
      expect((await result)[0].status).toBe('violated');
    }
  });
  it('uses numeric ordering checkpoints and preserves independent settlement relations', async () => {
    const { control, result } = execute('T21');
    await result;
    expect(control.events.map((event) => event.order)).toEqual(
      [2, 11, 10].map((revision) => ({ kind: 'versioned', revision }))
    );
    const accept = execute('T20');
    await accept.result;
    expect(accept.control.events[0]).toMatchObject({
      order: { kind: 'versioned', revision: 11 },
      settlement: { kind: 'accepts' },
    });
  });
  it('construction and disposal exceptions are errors, including a constructor unsupported marker', async () => {
    const bad = async (): Promise<Fixture> => {
      throw new UnsupportedSemantic('constructor');
    };
    const rows = await runSupplemental(
      { scalar: bad, occupied: bad },
      AUTHORITY_CASES
    );
    expect(rows.every((row) => row.status === 'error')).toBe(true);
    const broken = execute('A1', (f) => {
      f.dispose = () => {
        throw new Error('cleanup');
      };
    });
    expect((await broken.result)[0].status).toBe('error');
  });
});
