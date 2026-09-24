import { signalTree } from '../../lib/signal-tree';
import { external } from '../../lib/external';
import { confirmedTurnReader } from '../../internals';
import { transactions, peekInternalTransactionRuntime } from './transactions';

export async function run(mode: string) {
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  async function arrange() {
    const tree = signalTree(
      { payload: [] as unknown[] },
      { enhancers: [transactions()] }
    );
    const runtime = peekInternalTransactionRuntime(tree);
    const reader = confirmedTurnReader(tree);
    if (!runtime || !reader) throw new Error('Missing transaction runtime/reader');
    const obsolete: unknown[] = [new Uint8Array(1024 * 1024)];
    const weak = new WeakRef(obsolete);
    if (mode === 'external') {
      external(() => tree.$.payload(obsolete));
      await flush();
      external(() => tree.$.payload([1, 2]));
      await flush();
    } else {
      tree.transact(() => tree.$.payload(obsolete)).confirm();
      await flush();
      tree.transact(() => tree.$.payload([1, 2])).confirm();
      await flush();
    }
    const rawSnapshot =
      mode === 'raw-snapshot' ? runtime.getConfirmedTurnRecords() : undefined;
    const readerSnapshot =
      mode === 'reader-snapshot' ? reader.readConfirmedTurns() : undefined;
    const before = runtime.getConfirmedTurnCount();
    if (mode !== 'live') tree.destroy();
    await flush();
    return { tree, runtime, reader, weak, before, rawSnapshot, readerSnapshot };
  }
  const held = await arrange();
  if (!globalThis.gc) throw new Error('requires --expose-gc');
  for (let i = 0; i < 16; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    globalThis.gc();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  let refusal = false;
  if (mode !== 'live') {
    try {
      held.reader.readConfirmedTurns();
    } catch (error) {
      refusal =
        error instanceof Error &&
        error.message.includes('STUDIO_TREE_DESTROYED');
    }
  }
  const callerCount =
    held.rawSnapshot?.length ?? held.readerSnapshot?.turns.length;
  const result = {
    retained: held.weak.deref() !== undefined,
    before: held.before,
    after: held.runtime.getConfirmedTurnCount(),
    refusal,
    callerCount,
  };
  held.tree.destroy();
  return result;
}
