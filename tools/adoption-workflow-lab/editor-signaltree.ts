import { signal } from '@angular/core';
import {
  external,
  signalTree,
  transactions,
  type PendingTransaction,
} from '@signal-tree/angular';
import { check, domainJob, type Editor, type Job } from './model';

/** Generated consumer changes only the versioned transaction-opening spelling. */
export function createEditor(job: Job): Editor {
  const tree = signalTree(domainJob(job), { enhancers: [transactions()] });
  const active = signal(false);
  let handle: PendingTransaction | undefined;
  let live = true;
  return {
    read: () => {
      check(live, 'disposed-editor');
      return domainJob(tree.$());
    },
    pending: active,
    propose: (route) => {
      check(live && !active(), 'one-pending-proposal-per-editor');
      handle = tree.transact(() => tree.$.route.set(route));
      active.set(true);
    },
    confirm: () => {
      check(live && handle, 'confirm-requires-pending');
      handle.confirm();
      handle = undefined;
      active.set(false);
    },
    rollback: () => {
      check(live && handle, 'rollback-requires-pending');
      handle.rollback();
      handle = undefined;
      active.set(false);
    },
    receive: (next) => {
      check(
        live && next.instance === tree.$.instance(),
        'editor-entity-lifetime'
      );
      external(() => {
        tree.$.status.set(next.status);
        tree.$.revision.set(next.revision);
        tree.$.driverId.set(next.driverId);
        tree.$.priority.set(next.priority);
        if (!active()) tree.$.route.set(next.route);
      });
    },
    destroy: () => {
      tree.destroy();
      live = false;
      handle = undefined;
      active.set(false);
    },
  };
}
