import { readCanonicalSnapshot } from '@signal-tree/kernel/adapter';
import { type CapturedValue } from '@signal-tree/studio-query';

/**
 * The value at `path` in this tree **right now**.
 *
 *     THE PANEL MUST COMPARE AGAINST REALITY, NOT AGAINST ITS OWN HISTORY.
 *
 * ⚠️ WHY THIS EXISTS. Without it the Why? panel is tempted to treat
 * `latestRealization.after` as the current value — which would silently destroy
 * `currentValueExplained`, the warning that says retained evidence does NOT
 * explain what is on screen. That warning is only worth having if it is
 * computed against the live tree.
 *
 * ⚠️ NOT an `evalPath()` and not a string-expression evaluator. It reads the
 * canonical snapshot and walks it by the kernel's OWN path decomposition —
 * `applyAtRelativePath` splits on `'.'`, so this is the existing convention
 * rather than a new one.
 *
 * Cost note: this materializes a whole-tree snapshot to read one location. That
 * is acceptable for a diagnostic read on user action; it must not be put on any
 * hot path.
 */
export function readCurrentValue(
  tree: { readonly $: object },
  path: string
): CapturedValue {
  let node: unknown;
  try {
    node = readCanonicalSnapshot(tree);
  } catch (cause) {
    return {
      kind: 'unserializable',
      valueType: 'snapshot-failed',
      preview: String((cause as Error)?.message ?? cause),
    };
  }

  for (const segment of path.split('.')) {
    if (node === null || typeof node !== 'object') {
      // The path does not resolve. `undefined` is a legitimate VALUE, so this
      // is reported as unresolvable rather than as `undefined`.
      return { kind: 'unserializable', valueType: 'unresolved-path', preview: path };
    }
    node = (node as Record<string, unknown>)[segment];
  }

  // Same representation as captured evidence, so an unclonable live value
  // cannot crash the bridge or read as absent.
  try {
    return { kind: 'value', value: structuredClone(node) };
  } catch {
    return {
      kind: 'unserializable',
      valueType: typeof node,
      preview: typeof node === 'function' ? `function ${(node as { name?: string }).name || '(anonymous)'}` : String(node),
    };
  }
}
