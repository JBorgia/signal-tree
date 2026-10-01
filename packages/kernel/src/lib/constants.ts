/**
 * SignalTree Constants
 *
 * `SIGNAL_TREE_CONSTANTS` lived here and is DELETED in 15.0. Every member had
 * zero consumers once lazy signal creation went: the three `ESTIMATE_*` values
 * tuned `estimateObjectSize`, which existed only to decide lazy-vs-eager, and
 * `LAZY_THRESHOLD` went with it. `MAX_PATH_CACHE_SIZE`, `DEFAULT_CACHE_SIZE`
 * and `DEFAULT_BATCH_SIZE` were already unreferenced and had been carried along
 * inside the same object, which is how a dead constant hides — nothing flags an
 * unused MEMBER of a used object, and the object stopped being used only when
 * its last member did.
 *
 * The `dead-exports` gate caught this within one commit of being ratcheted to
 * zero. That is the ratchet earning itself.
 *
 * ⚠️ `SIGNAL_TREE_MESSAGES` WAS DELETED IN 15.4 for the same reason, one level
 * down. It was a frozen table of 29 messages of which THREE had a call site;
 * the other 26 codes were documented in `docs/errors/README.md` but nothing in
 * any package could emit them. Its `PROD_MESSAGES` was `DEV_MESSAGES` itself, so
 * the dev/prod selection chose between two names for one object — and choosing
 * needed a module-level `globalThis.process.env.NODE_ENV` probe, a top-level
 * side effect on the bare bundle's mandatory path. Measured: the table, the
 * probe and the selection were ~0.69 KB gzip of the bare bundle.
 *
 * What survives is exactly the three strings something emits, byte for byte.
 * Each message carries a stable, greppable error code `[ST####]` that maps to
 * a cause and fix in docs/errors/README.md. Codes are append-only and never
 * reused: ST1xxx = core/update/enhancer; ST2xxx = entity/markers.
 */

/** `signalTree(null | undefined)`. */
export const NULL_OR_UNDEFINED_MESSAGE = 'null/undefined [ST1001]';

/** `destroy()` under `debugMode`. */
export const TREE_DESTROYED_MESSAGE = 'destroyed [ST1012]';

/** `resolveEnhancerOrder` found a dependency cycle under `debugMode`. */
export const ENHANCER_CYCLE_DETECTED_MESSAGE = 'enhancer cycle [ST1024]';
