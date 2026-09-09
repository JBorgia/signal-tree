// Exercises the REAL content-script connect path from an isolated world.
import { connectToPage } from '../../content/bridge';

const report = (data: Record<string, unknown>) => {
  document.documentElement.setAttribute('data-st-smoke', JSON.stringify(data));
};

async function run() {
  // Let the page module install the bridge first.
  await new Promise((r) => setTimeout(r, 300));

  const pending = new Map<string, (v: unknown) => void>();
  let port: MessagePort;
  try {
    port = connectToPage();
  } catch (e) {
    report({ stage: 'connectToPage threw', error: String(e) });
    return;
  }

  // connectToPage installs its own onmessage; add ours alongside via a wrapper.
  const prior = port.onmessage;
  port.onmessage = (event: MessageEvent) => {
    prior?.call(port, event);
    const id = (event.data as { id?: string } | null)?.id;
    if (typeof id === 'string') {
      pending.get(id)?.(event.data);
      pending.delete(id);
    }
  };

  let n = 0;
  const req = (command: string, extra: Record<string, unknown> = {}) =>
    new Promise<unknown>((resolve) => {
      const id = `c${++n}`;
      const timer = setTimeout(() => resolve({ TIMEOUT: true }), 800);
      pending.set(id, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
      port.postMessage({ protocol: 1, id, command, ...extra });
    });

  const hello = await req('hello');
  const listTrees = await req('listTrees');
  const treeId =
    (listTrees as { value?: { id: string }[] })?.value?.[0]?.id ?? 'tree-0001';
  const read = await req('readConfirmedTurns', { treeId });

  report({ world: 'isolated', hello, listTrees, read });
}

void run();
