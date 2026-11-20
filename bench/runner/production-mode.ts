/**
 * Preloaded into every harness process (node --import) before Angular loads:
 * Angular's dev-mode checks are guarded by the global `ngDevMode`, which the
 * production browser build compiles away. Defining it false here makes the
 * Node micro gates measure the same code paths a production app runs.
 */
(globalThis as { ngDevMode?: unknown }).ngDevMode = false;
