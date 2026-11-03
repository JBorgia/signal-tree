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
 */

// Full developer-facing messages.
//
// Each message carries a stable, greppable error code `[ST####]`. The code is
// the anchor: search it in your code, a stack trace, or docs/errors/README.md
// (which maps every code to a cause + fix). This keeps the human-readable text
// (an earlier attempt used bare opaque integers like '0'/'1' — abandoned
// because they're meaningless in stack traces) while giving AI agents and
// tooling a stable handle for self-remediation. Codes are append-only and
// never reused: ST1xxx = core/update/enhancer; ST2xxx = entity/markers.
const DEV_MESSAGES = {
  NULL_OR_UNDEFINED: 'null/undefined [ST1001]',
  TREE_DESTROYED: 'destroyed [ST1012]',
  ENHANCER_CYCLE_DETECTED: 'enhancer cycle [ST1024]',
  // ST1032 (LAZY_NOT_INJECTED) and ST1004 (LAZY_FALLBACK) were removed in 15.0
  // with the lazy feature. ST1032 in particular told users to import from
  // `@signal-tree/kernel/lazy`, a subpath withdrawn from the published surface —
  // a runtime diagnostic giving advice that could not be followed.
} as const;

// Production and development use the same readable, stable messages.
// Selecting between aliases only introduced unnecessary environment reads.
export const SIGNAL_TREE_MESSAGES = Object.freeze(DEV_MESSAGES);
