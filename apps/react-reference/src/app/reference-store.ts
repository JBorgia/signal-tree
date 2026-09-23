import { entityMap, signalTree, transactions } from '@signal-tree/kernel';

export const TEAMS = ['North', 'South'] as const;
export type Team = (typeof TEAMS)[number];

export interface Job {
  id: string;
  title: string;
  site: string;
  owner: string;
  team: Team;
  priority: 'routine' | 'urgent';
  status: 'queued' | 'active' | 'done';
}

export interface Filters {
  team: Team;
  showCompleted: boolean;
}

/**
 * The filter boundary's rest position. `resetFilters()` restores exactly this,
 * and `filtersAreDefault` compares against it — one definition, so a new filter
 * field cannot be added to the state without also being reset.
 */
export const DEFAULT_FILTERS: Filters = { team: 'North', showCompleted: true };

const INITIAL_JOBS: Job[] = [
  {
    id: 'J-104',
    title: 'Replace pressure sensor',
    site: 'Plant 12',
    owner: 'Mina Okafor',
    team: 'North',
    priority: 'urgent',
    status: 'active',
  },
  {
    id: 'J-105',
    title: 'Inspect transfer pump',
    site: 'Yard 4',
    owner: 'Theo Martin',
    team: 'North',
    priority: 'routine',
    status: 'queued',
  },
  {
    id: 'J-106',
    title: 'Calibrate gate reader',
    site: 'North terminal',
    owner: 'Ari Chen',
    team: 'North',
    priority: 'routine',
    status: 'active',
  },
  {
    id: 'J-201',
    title: 'Seal conveyor housing',
    site: 'Plant 3',
    owner: 'Dana Reyes',
    team: 'South',
    priority: 'urgent',
    status: 'active',
  },
  {
    id: 'J-202',
    title: 'Service dust collector',
    site: 'Quarry 8',
    owner: 'Sam Iqbal',
    team: 'South',
    priority: 'routine',
    status: 'done',
  },
];

/** The one predicate. Both the visible projection and the selection-visibility
 * check route through it, so they cannot disagree about what "visible" means. */
const isVisible = (job: Job, filters: Filters): boolean =>
  job.team === filters.team && (filters.showCompleted || job.status !== 'done');

export const createReferenceStore = () => {
  const store = signalTree(
    {
      filters: { ...DEFAULT_FILTERS },
      jobs: entityMap<Job, string>({ selectId: (job) => job.id }),
    },
    {
      enhancers: [transactions()],
      // Cross-domain projections live here, NOT in a React selector and NOT in
      // `jobs.where()`. `where()` caches on predicate identity and invalidates
      // on the entity collection's version alone, so a predicate that reads
      // `$.filters` returns a stale list after a filter-only write. `derived`
      // tracks every location it reads, across domains, and returns an
      // Object.is-stable array while its inputs are unchanged — which is also
      // exactly what `useSyncExternalStore` requires of a snapshot.
      derived: ($) => ({
        visibleJobs: () => {
          const filters = {
            team: $.filters.team(),
            showCompleted: $.filters.showCompleted(),
          };
          return $.jobs.all().filter((job) => isVisible(job, filters));
        },
        activeJobCount: () => {
          const team = $.filters.team();
          return $.jobs
            .all()
            .filter((job) => job.team === team && job.status === 'active')
            .length;
        },
        /**
         * Selection is NOT cleared when a filter hides the selected job — the
         * filter boundary never writes into the jobs domain. The detail panel
         * reads this instead and says so.
         */
        selectionHiddenByFilters: () => {
          const active = $.jobs.activeEntity();
          if (!active) return false;
          return !isVisible(active, {
            team: $.filters.team(),
            showCompleted: $.filters.showCompleted(),
          });
        },
        filtersAreDefault: () =>
          $.filters.team() === DEFAULT_FILTERS.team &&
          $.filters.showCompleted() === DEFAULT_FILTERS.showCompleted,
      }),
    }
  );

  store.$.jobs.setAll(INITIAL_JOBS);
  store.$.jobs.setActiveId('J-104');

  return Object.assign(store, {
    selectJob(id: string): void {
      store.$.jobs.setActiveId(id);
    },

    setTeam(team: Team): void {
      store.$.filters.team(team);
    },

    setShowCompleted(show: boolean): void {
      store.$.filters.showCompleted(show);
    },

    /**
     * Reset behaviour. Both fields move in ONE transaction so no reader — and
     * no React render — can observe a half-reset filter set.
     */
    resetFilters(): void {
      store
        .transact(() => {
          store.$.filters.team(DEFAULT_FILTERS.team);
          store.$.filters.showCompleted(DEFAULT_FILTERS.showCompleted);
        })
        .confirm();
    },

    /**
     * Advance a job to `done`. Cross-domain READ: whether the job survives its
     * own completion depends on the filter boundary, so the successor selection
     * is decided from `filters` and applied atomically with the status write.
     */
    advance(id: string): void {
      const survivesCompletion = store.$.filters.showCompleted();
      const successor = survivesCompletion
        ? id
        : store.$.visibleJobs().find((job) => job.id !== id)?.id;

      store
        .transact(() => {
          store.$.jobs.updateOne(id, { status: 'done' });
          if (successor !== id) {
            if (successor) store.$.jobs.setActiveId(successor);
            else store.$.jobs.clearActiveId();
          }
        })
        .confirm();
    },
  });
};

/**
 * A second, deliberately minimal owner: proves `config.derived` realizes a
 * NEUTRAL callable (no ST2007) independently of the enhancer stack the main
 * reference store carries.
 */
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
