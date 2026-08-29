import type { WriteMetadata } from '../mutation-types';
import type { PathNotifier } from '../path-notifier';

/**
 * @internal The bare kernel's port onto path observation.
 *
 *     PRODUCERS MUST NOT STATICALLY OWN OPTIONAL DELIVERY MACHINERY.
 *     OPTIONAL OBSERVERS INSTALL DELIVERY AUTHORITY; THE CORE DEPENDS ONLY ON
 *     ITS NULLABLE PORT.
 *
 * ⚠️ WHY THIS MODULE EXISTS. `path-notifier.js` was 5,665 bytes of a 33.7 KB
 * bare bundle, and a controlled stub measured its DELIVERY machinery — pattern
 * matching, batching, microtask flush, interception — at 1.42 KB gzip, four
 * times the membership substrate and the dynamic seam combined. Every
 * subscriber in the repository is optional (restoration, devtools,
 * transactions, diagnostics, `link()`), and `owned-mutation` already
 * short-circuited on `hasObservers()`, so a consumer who subscribed to nothing
 * shipped the entire engine and executed none of it.
 *
 *     ZERO-RUNTIME COST IS NOT ZERO-BUNDLE COST
 *
 * The same rule was frozen and then DECLINED at the dynamic seam, where it was
 * worth 83 bytes. Here it is worth 1.42 KB.
 *
 * ⚠️ THIS MODULE MUST NEVER VALUE-IMPORT `path-notifier`. Both imports above
 * are TYPE-ONLY and erase at build; a value import would re-link the engine and
 * silently restore every byte while all behavioural tests still passed. The
 * bundle carrier is what defends this, not review.
 */

/**
 * The contract the kernel actually depends on.
 *
 *     A PORT MUST BE TYPED AS THE CONTRACT IT PROVIDES, NOT AS THE
 *     IMPLEMENTATION IT FORWARDS TO.
 *
 * ⚠️ THE PORT USED TO BE `{...} as unknown as PathNotifier`, and that fiction
 * produced a real defect: after `PathNotifier.intercept` was deleted, the port
 * kept exposing `intercept()` — `forward('intercept', noop)` with no target.
 * Callers got a SILENT NO-OP instead of a `TypeError`, which is strictly worse
 * than the method being gone. The cast let the facade claim the whole engine
 * shape with nothing checking it, so every future engine deletion could leave
 * another callable no-op behind.
 *
 * The one member here is derived from symbol-resolved production consumers, not
 * copied from the engine:
 *
 *     notify   entity-signal (18 sites) and owned-mutation, the write path
 *
 * ⚠️ THERE WAS A SECOND OPERATION, `emitMutation(envelope)`, until 15.0 (ME-B).
 * It existed for exactly one caller and transcoded a `MutationEnvelope` into
 * this same `notify` call. Two port operations for one publication job is one
 * too many:
 *
 *     ONE SEMANTIC PUBLICATION JOB, ONE PORT OPERATION.
 *
 * Everything else the facade forwarded — subscribe, onFlush, onReset, flush,
 * flushSync, setBatchingEnabled, isBatchingEnabled — has ZERO production callers
 * through the port. Optional consumers reach the engine directly via
 * `getPathNotifier()`, which is the point of the split.
 */
export interface PathObservationPort {
  notify(
    path: string,
    value: unknown,
    prev: unknown,
    ownerPath?: string,
    subjectIds?: number[],
    positionIds?: number[],
    metaOverride?: WriteMetadata,
    ownerId?: number
  ): void;
}

let runtime: PathNotifier | undefined;

/**
 * @internal Installed by `getPathNotifier()` the first time anything reaches
 * for a real engine — so installation is automatic for every optional consumer
 * and impossible for the bare kernel, which never imports that module.
 */
export function installPathDeliveryRuntime(next: PathNotifier): void {
  runtime = next;
}

/**
 * @internal Test seam. Detaches the port from the delivery engine.
 *
 * ⚠️ THIS ALONE USED TO CREATE AN INADMISSIBLE STATE. Clearing the port while
 * the engine kept its subscribers produced:
 *
 *     port.hasObservers()    false
 *     engine.hasObservers()  true
 *
 * and `owned-mutation` guards on the former, so a live subscriber silently
 * stopped receiving. Detaching is now paired with clearing the engine's own
 * observers, so no supported reset can leave a subscribed engine behind a
 * detached producer.
 */
export function resetPathDeliveryRuntime(): void {
  runtime?.clear?.();
  runtime = undefined;
}

/** @internal True only when a runtime is installed AND it has observers. */
export function hasPathObservers(): boolean {
  return runtime?.hasObservers() ?? false;
}

/**
 * A STABLE FACADE that always delegates to whatever is installed NOW.
 *
 * ⚠️ NOT A SNAPSHOT. An inert object handed out when nothing was installed was
 * captured by marker processors at construction and never updated — thirty-two
 * entity, link and undo tests failed. The facade is allocated once, holds no
 * state, and reads `runtime` on every call.
 *
 * With nothing installed each method is the correct answer rather than a
 * degraded one: no runtime means no subscribers, so there is nothing to deliver.
 */
const PORT: PathObservationPort = {
  notify(path, value, prev, ownerPath, subjectIds, positionIds, metaOverride, ownerId) {
    runtime?.notify(
      path,
      value,
      prev,
      ownerPath,
      subjectIds,
      positionIds,
      metaOverride,
      ownerId
    );
  },
};

/** @internal The delegating facade. Safe to capture and hold indefinitely. */
export function pathObservation(): PathObservationPort {
  return PORT;
}
