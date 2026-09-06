import { entityMap, signalTree, transactions } from '@signal-tree/kernel';

export interface Job {
  id: string;
  title: string;
  site: string;
  owner: string;
  priority: 'routine' | 'urgent';
  status: 'queued' | 'active' | 'done';
}

const INITIAL_JOBS: Job[] = [
  {
    id: 'J-104',
    title: 'Replace pressure sensor',
    site: 'Plant 12',
    owner: 'Mina Okafor',
    priority: 'urgent',
    status: 'active',
  },
  {
    id: 'J-105',
    title: 'Inspect transfer pump',
    site: 'Yard 4',
    owner: 'Theo Martin',
    priority: 'routine',
    status: 'queued',
  },
  {
    id: 'J-106',
    title: 'Calibrate gate reader',
    site: 'North terminal',
    owner: 'Ari Chen',
    priority: 'routine',
    status: 'active',
  },
];

export const createReferenceStore = () => {
  const store = signalTree(
    {
      filters: { team: 'North', showCompleted: true },
      jobs: entityMap<Job, string>({ selectId: (job) => job.id }),
    },
    {
      enhancers: [transactions()],
    }
  );

  store.$.jobs.setAll(INITIAL_JOBS);
  store.$.jobs.setActiveId('J-104');

  return Object.assign(store, {
    advance(id: string): void {
      const pending = store.transaction(() => {
        store.$.jobs.updateOne(id, { status: 'done' });
        store.$.filters.showCompleted(false);
      });
      pending.confirm();
    },
  });
};

export const createDerivedReferenceStore = () =>
  signalTree(
    {
      jobs: entityMap<Job, string>({ selectId: (job) => job.id }),
    },
    {
      derived: ($) => ({
        activeCount: () =>
          $.jobs.all().filter((job) => job.status === 'active').length,
      }),
    }
  );

export type ReferenceStore = ReturnType<typeof createReferenceStore>;
