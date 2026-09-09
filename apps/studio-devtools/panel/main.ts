/// <reference types="chrome" />

import {
  committedConsequence,
  type ConsequenceRow,
} from '../src/index';
import {
  STUDIO_EXTENSION_PORT,
  STUDIO_PROTOCOL_VERSION,
} from '../transport/protocol';

/**
 * The panel shell. Talks to the content script, renders the projection in
 * `src/` — which stays browser-independent and testable without a DOM.
 */

type Tree = { id: string; label?: string; capabilities: readonly string[] };

const root = document.getElementById('root') as HTMLElement;
const port = chrome.tabs
  ? chrome.runtime.connect({ name: STUDIO_EXTENSION_PORT })
  : undefined;
const extensionPort =
  port ??
  chrome.tabs?.connect(chrome.devtools.inspectedWindow.tabId, {
    name: STUDIO_EXTENSION_PORT,
  });

let nextId = 1;
const pending = new Map<string, (payload: unknown) => void>();

extensionPort?.onMessage.addListener((message: { id: string; payload: unknown }) => {
  pending.get(message.id)?.(message.payload);
  pending.delete(message.id);
});

/**
 * Silence is a meaningful answer: no page bridge means no Studio in this build.
 * The timeout is what turns "no response" into that statement rather than a
 * spinner that never resolves.
 */
function request<T>(command: string, extra: Record<string, unknown> = {}): Promise<T | undefined> {
  const id = `p${nextId++}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(undefined);
    }, 750);
    pending.set(id, (payload) => {
      clearTimeout(timer);
      resolve(payload as T);
    });
    extensionPort?.postMessage({
      id,
      payload: { protocol: STUDIO_PROTOCOL_VERSION, id, command, ...extra },
    });
  });
}

const el = (tag: string, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function renderEmpty(title: string, body: string) {
  root.replaceChildren();
  const pane = el('div', 'pane empty');
  pane.append(el('h2', undefined, title), el('p', 'muted', body));
  root.append(pane);
}

function renderRows(pane: HTMLElement, rows: readonly ConsequenceRow[]) {
  for (const row of rows) {
    const block = el('div', 'effect');
    block.append(
      el('div', 'path', row.path),
      el('div', 'delta', `${row.before} → ${row.after}${row.structural ? `  [${row.structural}]` : ''}`)
    );
    pane.append(block);
  }
}

async function showTurn(tree: Tree, turnIndex: number, turns: unknown[], retention: { truncated: boolean }) {
  const detail = el('div', 'pane');
  const turn = turns[turnIndex] as Parameters<typeof committedConsequence>[0];
  const view = committedConsequence(turn, { truncated: retention.truncated });

  detail.append(el('h2', undefined, `Transaction ${view.turnId}`), el('h2', undefined, 'Committed net consequence'));
  renderRows(detail, view.rows);

  const not = el('div', 'notObserved');
  not.append(el('h2', undefined, 'Not observed in S1'));
  const list = el('ul');
  for (const line of view.notObserved) list.append(el('li', undefined, line));
  not.append(list);
  detail.append(not);
  return detail;
}

async function render() {
  const hello = await request<{ protocol: number }>('hello');
  if (!hello) {
    renderEmpty(
      'No Studio-enabled SignalTree found',
      'Studio reads trees your application explicitly attaches in development. Import @signal-tree/studio-adapter/bridge and call installStudioBridge().'
    );
    return;
  }

  const trees = (await request<Tree[]>('listTrees')) ?? [];
  if (trees.length === 0) {
    renderEmpty('SignalTree Studio is enabled', 'No trees are currently attached.');
    return;
  }

  root.replaceChildren();
  const list = el('div', 'pane');
  list.append(el('h2', undefined, 'Trees'));
  const ul = el('ul');

  let selected = trees[0]!;
  const paint = async () => {
    const result = await request<{ ok: boolean; [k: string]: unknown }>(
      'readConfirmedTurns',
      { treeId: selected.id }
    );
    root.querySelector('.pane + .pane')?.remove();

    // A capability-less tree refuses structurally; say so rather than showing
    // an empty transaction list, which would read as "nothing happened".
    const payload = result as
      | { ok: true; value: { turns: unknown[]; retention: { truncated: boolean } } }
      | { ok: false; error: { code: string; capability?: string } }
      | undefined;

    if (!payload || payload.ok === false) {
      const pane = el('div', 'pane');
      pane.append(el('h2', undefined, selected.label ?? selected.id));
      pane.append(
        el('p', 'muted',
          payload && payload.ok === false && payload.error.code === 'STUDIO_CAPABILITY_UNAVAILABLE'
            ? 'Committed transaction history: not available — this tree does not use transactions().'
            : 'Committed transaction history is unavailable for this tree.')
      );
      root.append(pane);
      return;
    }

    const { turns, retention } = payload.value;
    if (turns.length === 0) {
      const pane = el('div', 'pane');
      pane.append(el('h2', undefined, selected.label ?? selected.id),
        el('p', 'muted', 'No committed transactions yet.'));
      root.append(pane);
      return;
    }
    root.append(await showTurn(selected, turns.length - 1, turns, retention));
  };

  for (const tree of trees) {
    const li = el('li');
    const button = el('button', undefined, tree.label ?? tree.id) as HTMLButtonElement;
    button.append(el('div', 'cap', tree.capabilities.length ? tree.capabilities.join(', ') : '—'));
    button.setAttribute('aria-current', String(tree === selected));
    button.onclick = () => {
      selected = tree;
      for (const other of ul.querySelectorAll('button')) other.setAttribute('aria-current', 'false');
      button.setAttribute('aria-current', 'true');
      void paint();
    };
    li.append(button);
    ul.append(li);
  }
  list.append(ul);
  root.append(list);
  await paint();
}

void render();
setInterval(() => void render(), 1500);
