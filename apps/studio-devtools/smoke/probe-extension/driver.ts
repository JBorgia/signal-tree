/// <reference types="chrome" />
/**
 * Stands in for panel/main.ts. Uses the SAME Chrome API pair the panel uses —
 * chrome.tabs.connect -> chrome.runtime.onConnect — differing only in how the
 * tab id is obtained (the panel reads chrome.devtools.inspectedWindow.tabId).
 */
const STUDIO_EXTENSION_PORT = 'signaltree-studio';
const out = (v: unknown) => {
  document.getElementById('out')!.textContent = JSON.stringify(v);
};

async function run() {
  const tabs = await chrome.tabs.query({ url: 'http://localhost:8791/index.html' });
  const tabId = tabs[0]?.id;
  if (tabId === undefined) return out({ error: 'no tab' });

  const port = chrome.tabs.connect(tabId, { name: STUDIO_EXTENSION_PORT });
  const pending = new Map<string, (v: unknown) => void>();
  port.onMessage.addListener((m: { id: string; payload: unknown }) => {
    pending.get(m.id)?.(m.payload);
    pending.delete(m.id);
  });

  let n = 0;
  const req = (command: string, extra: Record<string, unknown> = {}) =>
    new Promise<unknown>((resolve) => {
      const id = `p${++n}`;
      const timer = setTimeout(() => resolve({ TIMEOUT: true }), 1500);
      pending.set(id, (v) => { clearTimeout(timer); resolve(v); });
      // The panel's exact envelope shape.
      port.postMessage({ id, payload: { protocol: 1, id, command, ...extra } });
    });

  const hello = await req('hello');
  const listTrees = await req('listTrees');
  const treeId = (listTrees as { value?: { id: string }[] })?.value?.[0]?.id ?? 'tree-0001';
  const read = await req('readConfirmedTurns', { treeId });
  out({ chain: 'panel->content->page', hello, listTrees, read });
}
void run();
