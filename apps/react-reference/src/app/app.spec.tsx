import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { useSignalTree } from '@signal-tree/react';

import App from './app';
import {
  createReferenceStore,
  type Job,
  type ReferenceStore,
} from './reference-store';

const settleKernel = async () => {
  for (let index = 0; index < 4; index++) await Promise.resolve();
};

const liveStores = new Set<ReferenceStore>();
const makeStore = () => {
  const store = createReferenceStore();
  liveStores.add(store);
  return store;
};

afterEach(() => {
  for (const store of liveStores) store.destroy();
  liveStores.clear();
});

describe('greenfield React reference', () => {
  it('renders canonical scalar, nested, and entity values', () => {
    const store = makeStore();

    render(
      <StrictMode>
        <App store={store} />
      </StrictMode>
    );

    expect(screen.getByRole('heading', { name: 'Field work queue' })).toBeTruthy();
    expect(screen.getByLabelText('2 active jobs').textContent).toContain('North');
    expect(screen.getAllByText('Replace pressure sensor')).toHaveLength(2);
    expect(screen.getByText('Mina Okafor')).toBeTruthy();

  });

  it('rerenders after a canonical SignalTree write without mirroring', async () => {
    const store = makeStore();
    await settleKernel();
    render(<App store={store} />);

    fireEvent.click(screen.getByRole('button', { name: /Replace pressure sensor/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }));

    expect(store.$.jobs.byIdOrFail('J-104')().status).toBe('done');
    await waitFor(() => expect(screen.getByLabelText('1 active job')).toBeTruthy());

  });

  it('preserves a canonical entity projection across unrelated writes', async () => {
    const store = makeStore();
    await settleKernel();
    let renders = 0;

    function Queue() {
      renders++;
      const jobs = useSignalTree(store, ($) => $.jobs.all());
      return <output>{jobs.find((job) => job.id === 'J-104')?.status}</output>;
    }

    render(<Queue />);
    expect(screen.getByText('active')).toBeTruthy();
    const initialRenders = renders;

    await act(async () => {
      store.$.filters.team.set('South');
      await settleKernel();
    });

    expect(renders).toBe(initialRenders);

    await act(async () => {
      store.$.jobs.updateOne('J-104', { status: 'done' });
      await settleKernel();
    });

    await waitFor(() => expect(screen.getByText('done')).toBeTruthy());
  });

  it('uses owner invalidation only to wake a selected-location reread', async () => {
    const store = makeStore();
    await settleKernel();
    let renders = 0;
    let selectedReads = 0;

    function SelectedJob() {
      renders++;
      const job = useSignalTree(
        store,
        ($) => {
          selectedReads++;
          return $.jobs.byIdOrFail('J-104')();
        }
      );
      return <output>{job.status}</output>;
    }

    render(<SelectedJob />);
    const initialRenders = renders;
    const initialReads = selectedReads;

    await act(async () => {
      store.$.jobs.updateOne('J-105', { status: 'done' });
      await settleKernel();
    });

    expect(selectedReads).toBeGreaterThan(initialReads);
    expect(renders).toBe(initialRenders);

    await act(async () => {
      store.$.jobs.updateOne('J-104', { status: 'done' });
      await settleKernel();
    });

    await waitFor(() => expect(screen.getByText('done')).toBeTruthy());
    expect(renders).toBeGreaterThan(initialRenders);
  });

  it('releases StrictMode observation at unmount', async () => {
    const store = makeStore();
    let reads = 0;

    function Team() {
      const team = useSignalTree(store, ($) => {
        reads++;
        return $.filters.team();
      });
      return <output>{team}</output>;
    }

    const rendered = render(
      <StrictMode>
        <Team />
      </StrictMode>
    );
    rendered.unmount();
    const readsAfterUnmount = reads;

    await act(async () => {
      store.$.filters.team.set('South');
      await settleKernel();
    });

    expect(reads).toBe(readsAfterUnmount);
  });

  it('never renders an intermediate transaction state', async () => {
    const store = makeStore();
    await settleKernel();
    const seen: string[] = [];

    function CoherenceProbe() {
      const snapshot = useSignalTree(
        store,
        ($) => `${$.jobs.byIdOrFail('J-104')().status}:${$.filters.showCompleted()}`
      );
      seen.push(snapshot);
      return <output>{snapshot}</output>;
    }

    render(<CoherenceProbe />);
    await act(async () => {
      store.advance('J-104');
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText('done:false')).toBeTruthy());
    expect(seen).not.toContain('done:true');
    expect(seen).not.toContain('active:false');

  });

  it('keeps a held entity reference bound to its original lifetime', async () => {
    const store = makeStore();
    await settleKernel();
    const held = store.$.jobs.byIdOrFail('J-104');

    function HeldJobProbe() {
      const job = useSignalTree(
        store,
        ($) => {
          // `held` belongs to this same owner and remains its canonical
          // lifetime-specific location after the key is reused.
          void $;
          return held() as unknown as Job | undefined;
        }
      );
      return <output>{job?.status ?? 'retired'}</output>;
    }

    render(<HeldJobProbe />);
    expect(screen.getByText('active')).toBeTruthy();

    await act(async () => {
      store.$.jobs.removeOne('J-104');
      await Promise.resolve();
    });
    expect(screen.getByText('retired')).toBeTruthy();

    await act(async () => {
      store.$.jobs.addOne({
        id: 'J-104',
        title: 'Successor pressure sensor job',
        site: 'Plant 12',
        owner: 'Mina Okafor',
        priority: 'urgent',
        status: 'queued',
      });
      await Promise.resolve();
    });

    expect(screen.getByText('retired')).toBeTruthy();
    expect(store.$.jobs.byIdOrFail('J-104')().status).toBe('queued');

  });

  it('publishes active selection through the owner primitive', async () => {
    const store = makeStore();
    await settleKernel();
    const rendered = render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: /Inspect transfer pump/ }));
    await act(async () => settleKernel());

    expect(store.$.jobs.activeId()).toBe('J-105');
    expect(screen.getByText('Theo Martin')).toBeTruthy();
    expect(screen.queryByText('Mina Okafor')).toBeNull();

    rendered.unmount();
  });

  it('publishes owner-qualified upsertMany changes', async () => {
    const store = makeStore();
    await settleKernel();
    render(<App store={store} />);

    await act(async () => {
      store.$.jobs.upsertMany([
        {
          id: 'J-105',
          title: 'Inspect transfer pump',
          site: 'Yard 4',
          owner: 'Theo Martin',
          priority: 'routine',
          status: 'active',
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByLabelText('3 active jobs')).toBeTruthy());

  });

  it('keeps same-address publications from two owners distinct', async () => {
    const first = makeStore();
    const second = makeStore();
    await settleKernel();

    function Status({ store, label }: { store: ReferenceStore; label: string }) {
      const status = useSignalTree(
        store,
        ($) => $.jobs.all().find((job) => job.id === 'J-105')?.status
      );
      return <output aria-label={label}>{status}</output>;
    }

    render(
      <>
        <Status store={first} label="first owner" />
        <Status store={second} label="second owner" />
      </>
    );

    await act(async () => {
      first.$.jobs.updateOne('J-105', { status: 'active' });
      await Promise.resolve();
    });

    expect(screen.getByLabelText('first owner').textContent).toBe('active');
    expect(screen.getByLabelText('second owner').textContent).toBe('queued');

    await act(async () => {
      second.$.jobs.updateOne('J-105', { status: 'active' });
      await Promise.resolve();
    });

    expect(screen.getByLabelText('second owner').textContent).toBe('active');
  });

  it('makes owner destruction terminal for observation', async () => {
    const store = makeStore();
    function Team() {
      const team = useSignalTree(store, ($) => $.filters.team());
      return <output>{team}</output>;
    }

    const rendered = render(<Team />);
    expect(screen.getByText('North')).toBeTruthy();

    store.destroy();
    await act(async () => {
      store.$.filters.team.set('South');
      await settleKernel();
    });
    expect(screen.getByText('North')).toBeTruthy();

    rendered.unmount();
  });

  it('does not activate an owner destroyed before its first subscription', () => {
    const store = makeStore();
    store.destroy();

    function Team() {
      const team = useSignalTree(store, ($) => $.filters.team());
      return <output>{team}</output>;
    }

    const rendered = render(<Team />);

    expect(screen.getByText('North')).toBeTruthy();
    rendered.unmount();
  });

  it('never reuses a selected snapshot across owners', () => {
    const first = makeStore();
    const second = makeStore();
    second.$.filters.team.set('South');

    function Team({ store }: { store: ReferenceStore }) {
      const team = useSignalTree(
        store,
        ($) => $.filters.team()
      );
      return <output>{team}</output>;
    }

    const rendered = render(<Team store={first} />);
    expect(screen.getByText('North')).toBeTruthy();

    rendered.rerender(<Team store={second} />);
    expect(screen.getByText('South')).toBeTruthy();
  });
});
