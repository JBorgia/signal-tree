// Minimal fallback: exported functions match the impl shape but provide
// a safe no-op implementation. The full implementation lives in
// `@signaltree/devtools-impl` and should be dynamically imported by the
// main devtools shim in production/dev builds.
export function attachDevToolsSync(
  tree: unknown,
  _config?: Record<string, unknown>
) {
  // Provide a minimal __devTools surface so tests that call
  // attachDevToolsSync synchronously don't crash.
  void _config;
  try {
    Object.assign(tree, { __devTools: {} });
  } catch {
    // ignore
  }
  return tree;
}

export async function attachDevTools(
  tree: unknown,
  _config?: Record<string, unknown>
) {
  // Async noop fallback
  void _config;
  return attachDevToolsSync(tree, _config);
}

export default {
  attachDevTools,
  attachDevToolsSync,
};
