import { signal } from '@angular/core';
import {
  createCollection,
  createLiveQueryCollection,
  localOnlyCollectionOptions,
  eq,
  count,
  BasicIndex,
} from '@tanstack/db';
import {
  domainJob,
  type Driver,
  type Job,
  type Joined,
  type ReadModel,
} from './model';

/** In-memory accepted read model. Server policy belongs to the application authority. */
export function createReadModel(
  initialJobs: Job[],
  initialDrivers: Driver[]
): ReadModel {
  const jobs = createCollection(
    localOnlyCollectionOptions<Job, number>({
      getKey: (row) => row.id,
      initialData: initialJobs.map((row) => ({ ...row })),
    })
  );
  const drivers = createCollection(
    localOnlyCollectionOptions<Driver, number>({
      getKey: (row) => row.id,
      initialData: initialDrivers.map((row) => ({ ...row })),
    })
  );
  // Use the library's recommended join/filter indexes rather than benchmarking
  // its diagnostic fallback scan. Index creation belongs in construction cost.
  jobs.createIndex((row) => row.driverId, { indexType: BasicIndex });
  jobs.createIndex((row) => row.priority, { indexType: BasicIndex });
  const joined = createLiveQueryCollection((q) =>
    q
      .from({ job: jobs })
      .innerJoin({ driver: drivers }, ({ job, driver }) =>
        eq(job.driverId, driver.id)
      )
      .where(({ job }) => eq(job.priority, true))
      .select(({ job, driver }) => ({
        id: job.id,
        instance: job.instance,
        driverId: job.driverId,
        route: job.route,
        status: job.status,
        priority: job.priority,
        revision: job.revision,
        driver: driver.name,
        region: driver.region,
      }))
      .orderBy(({ job }) => job.id, 'asc')
  );
  const grouped = createLiveQueryCollection((q) =>
    q
      .from({ row: joined })
      .groupBy(({ row }) => row.region)
      .select(({ row }) => ({ region: row.region, count: count(row.id) }))
  );
  const revision = signal(0);
  const changed = () => revision.update((n) => n + 1);
  const subscriptions = [
    joined.subscribeChanges(changed),
    grouped.subscribeChanges(changed),
  ];
  return {
    ready: Promise.all([joined.preload(), grouped.preload()]).then(
      () => undefined
    ),
    view: () => {
      revision();
      // Strip TanStack virtual metadata at the application boundary.
      const rows: Joined[] = joined.toArray.map((row) => ({
        ...domainJob(row),
        driver: row.driver,
        region: row.region,
      }));
      const regions = grouped.toArray
        .map((row) => ({ region: row.region, count: row.count }))
        .sort((a, b) => a.region.localeCompare(b.region));
      return { rows, regions };
    },
    job: (id) => {
      const row = jobs.get(id);
      return row ? domainJob(row) : undefined;
    },
    updateJob: (id, change) => {
      jobs.update(id, (draft) => Object.assign(draft, change));
    },
    updateJobs: (changes) => {
      jobs.update(
        changes.map((change) => change.id),
        (drafts) =>
          drafts.forEach((draft, index) =>
            Object.assign(draft, changes[index].changes)
          )
      );
    },
    updateDriver: (id, change) => {
      drivers.update(id, (draft) => Object.assign(draft, change));
    },
    replaceJob: (row) => {
      jobs.update(row.id, (draft) => Object.assign(draft, row));
    },
    removeJob: (id) => {
      jobs.delete(id);
    },
    destroy: async () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      await grouped.cleanup();
      await joined.cleanup();
      await jobs.cleanup();
      await drivers.cleanup();
    },
  };
}
