import { describe, expect, it } from 'vitest';
import { signalTree, link, transactions } from '../index';
import {
  linkStateReader,
  type LinkStateEvent,
} from './internals/link-state-view';
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('read-only Link activity', () => {
  it('sees relationships created before attachment and distinguishes the same source twice', () => {
    const tree = signalTree({ x: 0 });
    const a = link(tree.$.x, {
      set() {
        return undefined;
      },
    });
    const b = link(tree.$.x, { get: () => 1 });
    try {
      const reader = linkStateReader(tree);
      const snapshot = reader.snapshot();
      expect(snapshot.links).toHaveLength(2);
      expect(new Set(snapshot.links.map((item) => item.id)).size).toBe(2);
      expect(snapshot.links[0].directions.set).toBe(true);
      expect(snapshot.links[1].directions.get).toBe(true);
      (snapshot.links[0].positions as number[]).push(999);
      expect(reader.snapshot().links[0].positions).not.toContain(999);
      a.dispose();
      expect(reader.snapshot().links).toHaveLength(1);
      b.dispose();
      expect(reader.snapshot().links).toEqual([]);
    } finally {
      a.dispose();
      b.dispose();
      tree.destroy();
    }
  });
  it('separates pending holds from actual I/O and survives observer failure', async () => {
    const tree = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const reader = linkStateReader(tree);
    const events: LinkStateEvent[] = [];
    const stop = reader.subscribe((event) => events.push(event));
    const stopThrow = reader.subscribe(() => {
      throw new Error('observer');
    });
    let finish!: () => void;
    const connection = link(tree.$.x, {
      set: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    try {
      const pending = tree.transact(() => tree.$.x(1));
      await tick();
      expect(reader.snapshot().links[0]).toMatchObject({
        held: true,
        sending: false,
      });
      pending.confirm();
      await tick();
      expect(reader.snapshot().links[0]).toMatchObject({
        held: false,
        sending: true,
      });
      finish();
      await connection.settled();
      expect(reader.snapshot().links[0]).toMatchObject({
        held: false,
        sending: false,
        queued: 0,
      });
      expect(events.some((event) => event.link.sending)).toBe(true);
      expect(events.at(-1)?.link.sending).toBe(false);
    } finally {
      stop();
      stopThrow();
      connection.dispose();
      tree.destroy();
    }
  });
  it('keeps tree identity separate and releases observation at destruction during retrieval', async () => {
    const a = signalTree({ x: 0 });
    const b = signalTree({ x: 0 });
    const ra = linkStateReader(a);
    const rb = linkStateReader(b);
    let finish!: (value: number) => void;
    const ca = link(a.$.x, {
      get: () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    });
    const cb = link(b.$.x, {
      set() {
        return undefined;
      },
    });
    const events: LinkStateEvent[] = [];
    ra.subscribe((event) => events.push(event));
    try {
      const retrieval = ca.retrieve();
      expect(ra.snapshot().links[0].retrieving).toBe(1);
      expect(ra.snapshot().treeId).not.toBe(rb.snapshot().treeId);
      a.destroy();
      const before = events.length;
      finish(2);
      await retrieval;
      expect(events).toHaveLength(before);
      expect(() => ra.snapshot()).toThrow(/destroyed/);
      expect(rb.snapshot().links).toHaveLength(1);
    } finally {
      ca.dispose();
      cb.dispose();
      a.destroy();
      b.destroy();
    }
  });
  it('does not allow one listener to rewrite evidence seen by another', () => {
    const tree = signalTree({ x: 0 });
    const reader = linkStateReader(tree);
    const events: LinkStateEvent[] = [];
    reader.subscribe((event) => {
      (event.link.positions as number[]).push(999);
      (event.link.directions as { set: boolean }).set = false;
    });
    reader.subscribe((event) => events.push(event));
    const connection = link(tree.$.x, {
      set() {
        return undefined;
      },
    });
    try {
      expect(events[0].kind).toBe('created');
      expect(events[0].link.directions.set).toBe(true);
      expect(events[0].link.positions).not.toContain(999);
      expect(reader.snapshot().links[0].positions).not.toContain(999);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('reports failed retrieval without retaining the exception or wedging activity', async () => {
    const tree = signalTree({ x: 0 });
    const reader = linkStateReader(tree);
    const events: LinkStateEvent[] = [];
    reader.subscribe((event) => events.push(event));
    const failure = new Error('private endpoint detail');
    const connection = link(tree.$.x, {
      get: async () => {
        throw failure;
      },
    });
    try {
      await expect(connection.retrieve()).rejects.toBe(failure);
      await connection.settled();
      expect(reader.snapshot().links[0].retrieving).toBe(0);
      expect(events.some((event) => event.kind === 'retrieve-failed')).toBe(
        true
      );
      expect(JSON.stringify(events)).not.toContain('private endpoint detail');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });

  it('failed relationship construction leaves no active observation record', () => {
    const tree = signalTree({ x: 0 });
    const reader = linkStateReader(tree);
    const failure = new Error('subscription failed');
    try {
      expect(() =>
        link(tree.$.x, {
          subscribe() {
            throw failure;
          },
        })
      ).toThrow(failure);
      expect(reader.snapshot().links).toEqual([]);
    } finally {
      tree.destroy();
    }
  });
  it('delivers reentrant relationship events in sequence order to every subscriber', () => {
    const tree = signalTree({ x: 0 });
    const reader = linkStateReader(tree);
    const connections: ReturnType<typeof link>[] = [];
    const seen: number[] = [];
    let created = false;
    reader.subscribe((event) => {
      if (event.kind === 'created' && !created) {
        created = true;
        connections.push(link(tree.$.x, { set: () => undefined }));
      }
    });
    reader.subscribe((event) => seen.push(event.sequence));
    try {
      connections.push(link(tree.$.x, { set: () => undefined }));
      expect(seen).toHaveLength(2);
      expect(seen).toEqual([...seen].sort((a, b) => a - b));
    } finally {
      for (const connection of connections) connection.dispose();
      tree.destroy();
    }
  });
  it('owns each subscription independently even for the same callback', () => {
    const tree = signalTree({ x: 0 });
    const reader = linkStateReader(tree);
    const events: LinkStateEvent[] = [];
    const callback = (event: LinkStateEvent) => events.push(event);
    const stopFirst = reader.subscribe(callback);
    const stopSecond = reader.subscribe(callback);
    const first = link(tree.$.x, { set: () => undefined });
    try {
      expect(events).toHaveLength(2);
      stopFirst();
      first.dispose();
      expect(events).toHaveLength(3);
      expect(events[2].kind).toBe('disposed');
    } finally {
      stopFirst();
      stopSecond();
      first.dispose();
      tree.destroy();
    }
  });
});

// Independent lifecycle review controls.
const idle = (s: LinkStateEvent['link']) =>
  !s.dirty &&
  !s.held &&
  !s.queued &&
  !s.sending &&
  !s.retrieving &&
  !s.disposed;

it('no all-idle publication between queued work and its first actual send', async () => {
  const t = signalTree({ x: 0 }),
    r = linkStateReader(t);
  let calls = 0,
    finish!: () => void;
  const falseIdle: LinkStateEvent[] = [];
  const c = link(t.$.x, {
    set: () => {
      calls++;
      return new Promise<void>((f) => (finish = f));
    },
  });
  r.subscribe((e) => {
    if (calls === 0 && idle(e.link)) falseIdle.push(e);
  });
  try {
    t.$.x(1);
    await tick();
    expect(calls).toBe(1);
    expect(falseIdle.map((e) => e.sequence)).toEqual([]);
  } finally {
    finish?.();
    await c.settled();
    c.dispose();
    t.destroy();
  }
});

for (const mode of ['send', 'retrieve'] as const)
  it(`dispose inside ${mode} notification prevents new endpoint call`, async () => {
    const t = signalTree({ x: 0 }),
      r = linkStateReader(t);
    let calls = 0,
      closed = false;
    const c = link(t.$.x, {
      set: () => {
        calls++;
      },
      get: () => {
        calls++;
        return 9;
      },
    });
    r.subscribe((e) => {
      if (
        !closed &&
        (mode === 'send' ? e.link.sending : e.link.retrieving > 0)
      ) {
        closed = true;
        c.dispose();
      }
    });
    try {
      if (mode === 'send') {
        t.$.x(1);
        await tick();
      } else await c.retrieve();
      expect(closed).toBe(true);
      expect(calls).toBe(0);
    } finally {
      c.dispose();
      t.destroy();
    }
  });

it('throwing external disposer cannot retain record or strand existing settled waiter', async () => {
  const t = signalTree({ x: 0 }),
    r = linkStateReader(t);
  let finish!: (v: number) => void;
  const c = link(t.$.x, {
    get: () => new Promise<number>((f) => (finish = f)),
    subscribe: () => () => {
      throw Error('cleanup');
    },
  });
  const retrieval = c.retrieve();
  let settled = false;
  const waiting = c.settled().then(() => {
    settled = true;
  });
  try {
    await tick();
    expect(() => c.dispose()).toThrow('cleanup');
    c.dispose();
    await tick();
    expect({ remaining: r.snapshot().links.length, settled }).toEqual({
      remaining: 0,
      settled: true,
    });
  } finally {
    finish(3);
    await retrieval;
    await waiting;
    t.destroy();
  }
});

for (const boundary of ['dispose', 'destroy'] as const)
  for (const outcome of ['resolve', 'reject'] as const)
    it(`late retrieval ${outcome} after ${boundary} emits no event`, async () => {
      const t = signalTree({ x: 0 }),
        r = linkStateReader(t);
      let finish!: (v: number) => void, fail!: (e: Error) => void;
      const events: LinkStateEvent[] = [];
      const c = link(t.$.x, {
        get: () =>
          new Promise<number>((a, b) => {
            finish = a;
            fail = b;
          }),
      });
      r.subscribe((e) => events.push(e));
      const p = c.retrieve().catch(() => undefined);
      try {
        if (boundary === 'dispose') c.dispose();
        else t.destroy();
        const n = events.length;
        if (outcome === 'resolve') finish(3);
        else fail(Error('private'));
        await p;
        expect(events.slice(n).map((e) => e.kind)).toEqual([]);
        if (boundary === 'dispose') expect(r.snapshot().links).toEqual([]);
        else expect(() => r.snapshot()).toThrow(/destroyed/);
      } finally {
        c.dispose();
        t.destroy();
      }
    });

it('construction failure after inbound activity leaves no record, publication or outbound send', async () => {
  const t = signalTree({ x: 0 }, { enhancers: [transactions()] }),
    r = linkStateReader(t);
  const events: LinkStateEvent[] = [];
  let sends = 0;
  r.subscribe((e) => events.push(e));
  try {
    expect(() =>
      link(t.$.x, {
        set: () => {
          sends++;
        },
        subscribe: (next) => {
          next(4);
          throw Error('construction');
        },
      })
    ).toThrow('construction');
    await tick();
    expect(r.snapshot().links).toEqual([]);
    expect(events).toEqual([]);
    expect(sends).toBe(0);
  } finally {
    t.destroy();
  }
});

it('reentrant delivery preserves order and start/stop excludes prior queued events', () => {
  const t = signalTree({ x: 0 }),
    r = linkStateReader(t);
  const handles: ReturnType<typeof link>[] = [];
  const b: number[] = [],
    d: number[] = [];
  let once = false;
  let stopB: () => void = () => undefined;
  const listener = (e: LinkStateEvent) => b.push(e.sequence);
  r.subscribe((e) => {
    if (!once) {
      once = true;
      handles.push(link(t.$.x, { get: () => 2 }));
      stopB();
      stopB = r.subscribe(listener);
      handles.push(link(t.$.x, { get: () => 3 }));
    }
  });
  stopB = r.subscribe(listener);
  r.subscribe((e) => d.push(e.sequence));
  try {
    handles.push(link(t.$.x, { get: () => 1 }));
    expect(b).toEqual([3]);
    expect(d).toEqual([1, 2, 3]);
  } finally {
    stopB();
    handles.forEach((c) => c.dispose());
    t.destroy();
  }
});

it('destroy during reentrant delivery suppresses remaining audience and queued events', () => {
  const t = signalTree({ x: 0 }),
    r = linkStateReader(t);
  const handles: ReturnType<typeof link>[] = [];
  let once = false,
    late = 0;
  r.subscribe(() => {
    if (!once) {
      once = true;
      handles.push(link(t.$.x, { get: () => 2 }));
      t.destroy();
    }
  });
  r.subscribe(() => late++);
  try {
    handles.push(link(t.$.x, { get: () => 1 }));
    expect(late).toBe(0);
    expect(() => r.subscribe(() => undefined)).toThrow(/destroyed/);
  } finally {
    handles.forEach((c) => c.dispose());
    t.destroy();
  }
});

it('snapshot during reentry plus new subscription sees only later events', () => {
  const t = signalTree({ x: 0 }),
    r = linkStateReader(t);
  const handles: ReturnType<typeof link>[] = [];
  const late: number[] = [];
  let once = false,
    boundary = 0;
  r.subscribe(() => {
    if (!once) {
      once = true;
      handles.push(link(t.$.x, { get: () => 2 }));
      r.subscribe((e) => late.push(e.sequence));
      boundary = r.snapshot().sequence;
      handles.push(link(t.$.x, { get: () => 3 }));
    }
  });
  try {
    handles.push(link(t.$.x, { get: () => 1 }));
    expect(boundary).toBe(2);
    expect(late).toEqual([3]);
  } finally {
    handles.forEach((c) => c.dispose());
    t.destroy();
  }
});

it('late attach has no retrospective event replay and no disposed records', async () => {
  const t = signalTree({ x: 0 });
  const c = link(t.$.x, { set: () => undefined });
  try {
    for (let i = 1; i <= 20; i++) {
      t.$.x(i);
      await tick();
    }
    c.dispose();
    const r = linkStateReader(t);
    const events: LinkStateEvent[] = [];
    r.subscribe((e) => events.push(e));
    await tick();
    expect(events).toEqual([]);
    expect(r.snapshot().links).toEqual([]);
  } finally {
    c.dispose();
    t.destroy();
  }
});

it('foreign tree and sibling branch activity do not become relationship activity', async () => {
  const t = signalTree({ a: { x: 0 }, b: { x: 0 } }),
    foreign = signalTree({ a: { x: 0 } }),
    r = linkStateReader(t);
  const sends: number[] = [],
    events: LinkStateEvent[] = [];
  const c = link(t.$.a, {
    set: (v) => {
      sends.push(v.x);
    },
  });
  r.subscribe((e) => events.push(e));
  try {
    foreign.$.a.x(7);
    t.$.b.x(8);
    await tick();
    expect(events).toEqual([]);
    t.$.a.x(9);
    await c.settled();
    expect(sends).toEqual([9]);
  } finally {
    c.dispose();
    t.destroy();
    foreign.destroy();
  }
});

for (const boundary of ['dispose', 'destroy'] as const)
  for (const outcome of ['resolve', 'reject'] as const)
    it(`late send ${outcome} after ${boundary} emits no event`, async () => {
      const t = signalTree({ x: 0 }),
        r = linkStateReader(t);
      let finish!: () => void, fail!: (e: Error) => void;
      const events: LinkStateEvent[] = [];
      const c = link(t.$.x, {
        set: () =>
          new Promise<void>((a, b) => {
            finish = a;
            fail = b;
          }),
      });
      r.subscribe((e) => events.push(e));
      try {
        t.$.x(1);
        await tick();
        if (boundary === 'dispose') c.dispose();
        else t.destroy();
        const n = events.length;
        if (outcome === 'resolve') finish();
        else fail(Error('private'));
        await tick();
        expect(events.slice(n).map((e) => e.kind)).toEqual([]);
      } finally {
        finish?.();
        c.dispose();
        t.destroy();
      }
    });
