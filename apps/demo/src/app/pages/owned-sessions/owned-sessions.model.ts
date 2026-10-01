import { signal } from '@angular/core';
import { entityMap, external, signalTree } from '@signal-tree/angular';

export interface DemoDocument {
  id: string;
  lifetime: number;
  revision: number;
  title: string;
}

export function createDocumentTree() {
  const tree = signalTree({ documents: entityMap<DemoDocument, string>() });
  tree.$.documents.addOne({
    id: 'order-1',
    lifetime: 1,
    revision: 1,
    title: 'Inspect delivery',
  });
  return tree;
}
export type DocumentTree = ReturnType<typeof createDocumentTree>;
export type ApplyResult =
  | 'applied'
  | 'closed'
  | 'missing'
  | 'replaced'
  | 'changed'
  | 'invalid';

/** Application-owned edit session. No trees are mounted, mirrored or merged. */
export function createEditorSession(
  id: string,
  canonical: DocumentTree,
  documentId: string
) {
  const initial = canonical.$.documents.byId(documentId)?.();
  if (!initial)
    throw new Error('Open an editor only for an existing document.');
  let base = { ...initial };
  const draft = signalTree({ title: initial.title });
  const notice = signal('');
  return {
    id,
    documentId,
    draft,
    notice,
    apply(): ApplyResult {
      if (draft.destroyed() || canonical.destroyed()) return 'closed';
      const current = canonical.$.documents.byId(documentId)?.();
      if (!current) return 'missing';
      // The demo uses explicit application revision/lifetime tokens. A real
      // backend must enforce its own conditional write; this is not MVCC.
      if (current.lifetime !== base.lifetime) return 'replaced';
      if (current.revision !== base.revision) return 'changed';
      const title = draft.$.title().trim();
      if (!title) return 'invalid';
      canonical.$.documents.updateOne(documentId, {
        title,
        revision: current.revision + 1,
      });
      base = { ...current, title, revision: current.revision + 1 };
      return 'applied';
    },
    reload(): boolean {
      if (draft.destroyed() || canonical.destroyed()) return false;
      const current = canonical.$.documents.byId(documentId)?.();
      // Reload never silently retargets an editor to a replacement lifetime.
      if (!current || current.lifetime !== base.lifetime) return false;
      base = { ...current };
      draft.$.title.set(base.title);
      notice.set('Draft replaced with current values.');
      return true;
    },
    destroy() {
      draft.destroy();
    },
  };
}
export type EditorSession = ReturnType<typeof createEditorSession>;

export type SampleSource = (receive: (value: number) => void) => () => void;

/** A resource belongs to its device session, not to a collection value. */
export function createDeviceSession(id: string, subscribe: SampleSource) {
  const tree = signalTree({ lastSample: 0, received: 0 });
  try {
    const stop = subscribe((value) => {
      if (tree.destroyed()) return; // Also guard a callback already in flight.
      external(() => {
        tree.$.lastSample.set(value);
        tree.$.received.update((count) => count + 1);
      });
    });
    tree.registerCleanup(stop);
  } catch (error) {
    tree.destroy();
    throw error;
  }
  return { id, tree, destroy: () => tree.destroy() };
}
export type DeviceSession = ReturnType<typeof createDeviceSession>;
