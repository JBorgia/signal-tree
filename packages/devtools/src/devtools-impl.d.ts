declare module '@signaltree/devtools-impl' {
  // Minimal shape expected by the devtools shim. The real implementation
  // is dynamically imported at runtime; these declarations allow the
  // package to compile without needing the impl package types during
  // ng-packagr builds.
  import type { SignalTree } from '@signaltree/core';

  export function attachDevTools<T>(
    tree: SignalTree<T>,
    config?: Record<string, unknown>
  ): Promise<any>;
  export function attachDevToolsSync<T>(
    tree: SignalTree<T>,
    config?: Record<string, unknown>
  ): any;

  export default {} as {
    attachDevTools: typeof attachDevTools;
    attachDevToolsSync: typeof attachDevToolsSync;
  };
}
