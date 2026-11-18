import { Workspace } from './workflow';
import { check, seed, summarize, settle, type Job } from './model';

const same = (actual: unknown, expected: unknown, label: string) =>
  check(JSON.stringify(actual) === JSON.stringify(expected), label);

export async function functionalChecks(
  queryFault?: 'group-count'
): Promise<string[]> {
  const passed: string[] = [];
  const workspace = new Workspace(100);
  await workspace.ready;
  try {
    const first = workspace.open(0),
      second = workspace.open(0);
    workspace.propose(first, 'West');
    workspace.propose(second, 'East');
    const a = workspace.editors()[0].editor,
      b = workspace.editors()[1].editor;
    check(
      a.read().route === 'West' && b.read().route === 'East',
      'independent-editors'
    );
    passed.push('independent-editors');
    workspace.ship(0);
    workspace.reject(first);
    check(
      a.read().route === 'North' && a.read().status === 'Shipped',
      'external-status-survives-rejection'
    );
    check(
      b.read().route === 'East' && b.pending(),
      'other-editor-stays-pending'
    );
    passed.push(
      'external-status-survives-rejection',
      'other-editor-stays-pending'
    );
    const accepted = await workspace.save(second);
    check(
      accepted.status === 'applied' && workspace.model.job(0)?.route === 'East',
      'accepted-result'
    );
    passed.push('accepted-result');
    workspace.close(first);
    workspace.close(second);
    let disposed = false;
    try {
      a.read();
    } catch {
      disposed = true;
    }
    check(disposed, 'closed-editor-unusable');
    passed.push('closed-editor-unusable');

    const conflict = workspace.open(3);
    workspace.propose(conflict);
    workspace.externalRoute(3, 'East');
    const refused = await workspace.save(conflict);
    check(
      refused.reason === 'route-revision' &&
        workspace.model.job(3)?.route === 'East',
      'stale-write-rejected'
    );
    workspace.close(conflict);
    passed.push('stale-write-rejected');

    const discard = workspace.open(15);
    workspace.propose(discard);
    workspace.externalRoute(15, 'East');
    workspace.reject(discard);
    check(
      workspace.editors()[0].editor.read().route === 'East',
      'discard-refreshes-accepted-route'
    );
    workspace.propose(discard, 'North');
    check(
      (await workspace.save(discard)).status === 'applied',
      'discard-refreshes-revision'
    );
    workspace.close(discard);
    passed.push(
      'discard-refreshes-accepted-route',
      'discard-refreshes-revision'
    );

    const race = workspace.open(18);
    workspace.propose(race);
    const saving = workspace.save(race, 'race');
    let raceRejected = false;
    try {
      workspace.reject(race);
      workspace.propose(race, 'East');
    } catch {
      raceRejected = true;
    }
    check(raceRejected, 'in-flight-proposal-cannot-change');
    check(
      (await saving).status === 'applied' &&
        workspace.model.job(18)?.route === 'West',
      'in-flight-captured-route'
    );
    workspace.close(race);
    passed.push('in-flight-proposal-cannot-change', 'in-flight-captured-route');

    const closed = workspace.open(21);
    workspace.propose(closed);
    const closingSave = workspace.save(closed, 'closed');
    workspace.close(closed);
    let closeRejected = false;
    try {
      await closingSave;
    } catch {
      closeRejected = true;
    }
    check(
      closeRejected && workspace.model.job(21)?.route === 'North',
      'close-cancels-unaccepted-save'
    );
    passed.push('close-cancels-unaccepted-save');

    const replaced = workspace.open(6);
    workspace.propose(replaced);
    workspace.replace(6);
    const replacement = await workspace.save(replaced);
    check(
      replacement.reason === 'entity-lifetime' &&
        workspace.model.job(6)?.route === 'North',
      'replacement-rejected'
    );
    workspace.close(replaced);
    passed.push('replacement-rejected');

    const rejected = workspace.open(9);
    workspace.propose(rejected);
    const denied = await workspace.save(rejected, 'deny-9', true);
    check(
      denied.status === 'rejected' && workspace.model.job(9)?.route === 'North',
      'service-rejection'
    );
    workspace.close(rejected);
    passed.push('service-rejection');

    const uncertain = workspace.open(12);
    workspace.propose(uncertain);
    const beforeEffects = workspace.effects;
    await workspace.save(uncertain, 'lost-reply', false, true);
    check(workspace.editors()[0].editor.pending(), 'uncertain-stays-pending');
    await workspace.save(uncertain, 'lost-reply');
    check(
      workspace.effects === beforeEffects + 1 &&
        !workspace.editors()[0].editor.pending(),
      'receipt-reconciliation'
    );
    workspace.propose(uncertain, 'North');
    let commandRejected = false;
    try {
      await workspace.save(uncertain, 'lost-reply');
    } catch {
      commandRejected = true;
    }
    check(
      commandRejected && workspace.editors()[0].editor.pending(),
      'command-cannot-confirm-new-proposal'
    );
    const repeated = await workspace.save(uncertain);
    check(
      repeated.status === 'applied' &&
        workspace.model.job(12)?.route === 'North',
      'editor-can-save-again'
    );
    passed.push('command-cannot-confirm-new-proposal', 'editor-can-save-again');
    workspace.close(uncertain);
    passed.push('uncertain-stays-pending', 'receipt-reconciliation');
  } finally {
    await workspace.destroy();
  }

  const query = new Workspace(100);
  const expected = seed(100);
  if (queryFault === 'group-count') {
    const view = query.model.view;
    query.model.view = () => {
      const actual = view();
      return {
        ...actual,
        regions: actual.regions.map((group, index) => ({
          ...group,
          count: group.count + (index === 0 ? 1 : 0),
        })),
      };
    };
  }
  try {
    await query.ready;
    for (let index = 0; index < 24; index++) {
      const id = index * 3;
      const change: Partial<Job> = {
        priority: index % 2 === 0,
        route: index % 2 ? 'East' : 'West',
      };
      Object.assign(expected.jobs[id], change);
      query.model.updateJob(id, change);
      if (index % 4 === 0) {
        const driver = index % expected.drivers.length;
        expected.drivers[driver].region = 'Changed';
        query.model.updateDriver(driver, { region: 'Changed' });
      }
      await settle();
      const drivers = new Map(expected.drivers.map((row) => [row.id, row]));
      const oracle = summarize(
        expected.jobs
          .filter((row) => row.priority)
          .map((row) => {
            const driver = drivers.get(row.driverId)!;
            return { ...row, driver: driver.name, region: driver.region };
          })
      );
      same(query.model.view(), oracle, `query-update-${index}`);
    }
    query.model.removeJob(0);
    expected.jobs.splice(0, 1);
    await settle();
    check(
      !query.model.view().rows.some((row) => row.id === 0),
      'query-removal'
    );
    const oracle = () => {
      const drivers = new Map(expected.drivers.map((row) => [row.id, row]));
      return summarize(
        expected.jobs
          .filter((row) => row.priority)
          .map((row) => {
            const driver = drivers.get(row.driverId)!;
            return { ...row, driver: driver.name, region: driver.region };
          })
      );
    };
    same(query.model.view(), oracle(), 'query-removal-complete');
    const row = expected.jobs.find((row) => row.id === 3)!;
    Object.assign(row, {
      instance: 2,
      priority: true,
      driverId: 2,
      route: 'North',
    });
    query.model.replaceJob(row);
    await settle();
    same(query.model.view(), oracle(), 'query-replacement-complete');
    const changes = [
      { id: 4, changes: { priority: true } },
      { id: 5, changes: { priority: false } },
    ];
    for (const change of changes)
      Object.assign(
        expected.jobs.find((row) => row.id === change.id)!,
        change.changes
      );
    query.ingestJobs(changes);
    await settle();
    same(query.model.view(), oracle(), 'query-bulk-complete');
    passed.push(
      'joined-and-grouped-updates',
      'query-removal',
      'query-removal-complete',
      'query-replacement-complete',
      'query-bulk-complete'
    );
  } finally {
    await query.destroy();
  }

  const owner = new Workspace(40);
  await owner.ready;
  const key = owner.open();
  const retained = owner.editors()[0].editor;
  owner.propose(key);
  await owner.destroy();
  let rejected = false;
  try {
    retained.read();
  } catch {
    rejected = true;
  }
  check(rejected && owner.editors().length === 0, 'owner-teardown');
  passed.push('owner-teardown');
  return passed;
}
