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

// Production messages use the same short readable strings as dev.
// The numeric-code approach was abandoned: bare integers ('0','1','2') are
// completely opaque in production stack traces and tooling. The dev strings
// are already concise (<25 chars each) so bundle impact is negligible.
const PROD_MESSAGES = DEV_MESSAGES;

// Prefer Angular's compile-time `ngDevMode` flag. When `ngDevMode` is false
// in production builds, DEV_MESSAGES can be tree-shaken. Fallback to
// process.env when ngDevMode is not present.
declare const ngDevMode: boolean | undefined;
// Avoid referencing the bare `process` identifier to keep builds free of Node
// type assumptions; use globalThis to check env when available.
const _isProdByEnv = Boolean(
  typeof globalThis === 'object' &&
    globalThis !== null &&
    'process' in globalThis &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (globalThis as any).process === 'object' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'env' in (globalThis as any).process &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process.env.NODE_ENV === 'production'
);

const _isDev =
  typeof ngDevMode !== 'undefined' ? Boolean(ngDevMode) : !_isProdByEnv;


export const SIGNAL_TREE_MESSAGES = Object.freeze(
  _isDev
    ? (DEV_MESSAGES as typeof DEV_MESSAGES)
    : (PROD_MESSAGES as typeof DEV_MESSAGES)
);
