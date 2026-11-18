import { computed } from '@angular/core';
import { signalTree, entityMap, external } from '@signal-tree/angular';
import {
  domainJob,
  summarize,
  type Driver,
  type Job,
  type ReadModel,
} from './model';

/** Accepted data has one owner. These are shared derived queries, not an IVM engine. */
export function createReadModel(jobs: Job[], drivers: Driver[]): ReadModel {
  const tree = signalTree({
    jobs: entityMap<Job, number>({ selectId: (row) => row.id }),
    drivers: entityMap<Driver, number>({ selectId: (row) => row.id }),
  });
  external(() => {
    tree.$.jobs.setAll(jobs.map((row) => ({ ...row })));
    tree.$.drivers.setAll(drivers.map((row) => ({ ...row })));
  });
  const driverIndex = computed(
    () => new Map(tree.$.drivers.all().map((row) => [row.id, row]))
  );
  const view = computed(() => {
    const index = driverIndex();
    return summarize(
      tree.$.jobs
        .all()
        .filter((job) => job.priority)
        .flatMap((job) => {
          const driver = index.get(job.driverId);
          return driver
            ? [
                {
                  ...domainJob(job),
                  driver: driver.name,
                  region: driver.region,
                },
              ]
            : [];
        })
    );
  });
  return {
    ready: Promise.resolve(),
    view,
    job: (id) => {
      const row = tree.$.jobs.byId(id);
      return row ? domainJob(row()) : undefined;
    },
    updateJob: (id, change) =>
      external(() => tree.$.jobs.updateOne(id, change)),
    updateJobs: (changes) =>
      external(() => {
        // The installed EntityMap API takes one partial value for a set of keys.
        // Group equal partials rather than pretend it accepts NgRx-style records.
        const groups = new Map<
          string,
          { ids: number[]; changes: Partial<Job> }
        >();
        for (const change of changes) {
          const key = JSON.stringify(change.changes);
          const group = groups.get(key);
          if (group) group.ids.push(change.id);
          else groups.set(key, { ids: [change.id], changes: change.changes });
        }
        for (const group of groups.values())
          tree.$.jobs.updateMany(group.ids, group.changes);
      }),
    updateDriver: (id, change) =>
      external(() => tree.$.drivers.updateOne(id, change)),
    replaceJob: (row) =>
      external(() => tree.$.jobs.replaceOne(row.id, { ...row })),
    removeJob: (id) => external(() => tree.$.jobs.removeOne(id)),
    destroy: async () => {
      tree.destroy();
    },
  };
}
