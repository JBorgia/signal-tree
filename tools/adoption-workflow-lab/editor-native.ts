import { signal } from '@angular/core';
import { check, domainJob, type Editor, type Job, type Route } from './model';

/** Competent small counterfactual: application-owned field inverse, not a general transaction. */
export function createEditor(job: Job): Editor {
  const value = signal(domainJob(job));
  const active = signal(false);
  let oldRoute: Route = job.route;
  let live = true;
  return {
    read: () => {
      check(live, 'disposed-editor');
      return domainJob(value());
    },
    pending: active,
    propose: (route) => {
      check(live && !active(), 'one-pending-proposal-per-editor');
      oldRoute = value().route;
      active.set(true);
      value.update((current) => ({ ...current, route }));
    },
    confirm: () => {
      check(live && active(), 'confirm-requires-pending');
      active.set(false);
    },
    rollback: () => {
      check(live && active(), 'rollback-requires-pending');
      value.update((current) => ({ ...current, route: oldRoute }));
      active.set(false);
    },
    receive: (next) => {
      check(
        live && next.instance === value().instance,
        'editor-entity-lifetime'
      );
      value.update((current) => ({
        ...domainJob(next),
        route: active() ? current.route : next.route,
      }));
    },
    destroy: () => {
      live = false;
      active.set(false);
    },
  };
}
