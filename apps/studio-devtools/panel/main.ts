/// <reference types="chrome" />

import type {
  CapturedValue,
  EvidenceSet,
  RealizationEvidence,
  TransactionEvidence,
} from '@signal-tree/studio-query';

import { whyValue, type WhyView } from '../src/index';
import {
  STUDIO_EXTENSION_PORT,
  STUDIO_PROTOCOL_VERSION,
} from '../transport/protocol';

/**
 * The SignalTree Studio panel.
 *
 *     THE SHELL ISSUES COMMANDS AND RENDERS CLAIMS. IT COMPUTES NO SEMANTICS.
 *
 * ⚠️ `whyValue` classifies every line and attaches its evidence; nothing here
 * decides what is a FACT, and nothing here draws a causal arrow. The current
 * value comes from a LIVE `readCurrentValue`, never from
 * `latestRealization.after` — reading it out of the evidence would make
 * "explained by retained evidence" true by construction, which is precisely the
 * claim the panel needs to be able to deny.
 *
 * ⚠️ Deliberately plain. The state picker, evidence drawer, River and Pulse are
 * downstream of actually using this, not of mockups.
 */

type Tree = { id: string; label?: string; capabilities: readonly string[] };

type CaptureSnapshot = {
  effects: readonly Omit<RealizationEvidence, 'kind' | 'treeId'>[];
  coverage: {
    completeFromTreeStart: false;
    scopeIntegrity: 'complete' | 'incomplete-unscoped-evidence';
    startedAtSequence: number;
  };
  retention: { retained: number; truncated: boolean };
};

type RealizationRead =
  | { support: 'unsupported'; reason: string }
  | { support: 'supported'; capture: 'inactive' }
  | { support: 'supported'; capture: 'active'; snapshot: CaptureSnapshot };

type TurnRead = {
  turns: readonly {
    id: number;
    effects: readonly { path: string; ownerPath?: string; before: unknown; after: unknown }[];
  }[];
};

// ── transport ────────────────────────────────────────────────────────────────

const root = document.getElementById('root') as HTMLElement;
const port = chrome.tabs.connect(chrome.devtools.inspectedWindow.tabId, {
  name: STUDIO_EXTENSION_PORT,
});

let nextId = 1;
const pending = new Map<string, (payload: unknown) => void>();
port.onMessage.addListener((m: { id: string; payload: unknown }) => {
  pending.get(m.id)?.(m.payload);
  pending.delete(m.id);
});

/**
 * ⚠️ SILENCE IS AN ANSWER. A page with no Studio bridge never replies, and the
 * only truthful reading of that is "no Studio here" — not a spinner that waits
 * forever for an event that cannot arrive.
 */
function send<T>(command: string, extra: Record<string, unknown> = {}): Promise<T | undefined> {
  const id = `p${nextId++}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(undefined);
    }, 900);
    pending.set(id, (payload) => {
      clearTimeout(timer);
      const r = payload as { ok?: boolean; value?: unknown; error?: { code: string; capability?: string } };
      if (!r?.ok) {
        lastError = r?.error;
        resolve(undefined);
        return;
      }
      resolve(r.value as T);
    });
    port.postMessage({ id, payload: { protocol: STUDIO_PROTOCOL_VERSION, id, command, ...extra } });
  });
}

// ── state ────────────────────────────────────────────────────────────────────

let connected = false;
let trees: Tree[] = [];
let selected: Tree | undefined;
let path = '';
let pathDraft = '';
let realization: RealizationRead | undefined;
/**
 * ⚠️ SURVIVES STOP. The recorder releases its retained evidence on dispose; the
 * investigation does not end because recording did.
 */
let held: CaptureSnapshot | undefined;
let turns: TurnRead['turns'] = [];
let currentValue: CapturedValue | undefined;
let openEvidence: string | undefined;
let lastError: { code: string; capability?: string } | undefined;

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Whichever snapshot is authoritative right now: live capture, else held. */
function snapshot(): CaptureSnapshot | undefined {
  return realization?.support === 'supported' && realization.capture === 'active'
    ? realization.snapshot
    : held;
}

/**
 * Assemble the real evidence set. No inference — every field is carried
 * through from what the bridge reported.
 */
function evidenceSet(treeId: string): EvidenceSet {
  const snap = snapshot();
  const transactions: TransactionEvidence[] = turns.map((t) => ({
    kind: 'transaction',
    treeId,
    turnId: t.id,
    disposition: 'committed',
    effects: t.effects.map((e) => ({
      path: e.path,
      ownerPath: e.ownerPath ?? e.path,
      before: e.before,
      after: e.after,
    })),
  }));
  const realizations: RealizationEvidence[] = (snap?.effects ?? []).map((e) => ({
    ...e,
    kind: 'realization',
    treeId,
  }));
  return {
    transactions,
    realizations,
    coverage: snap
      ? { ...snap.coverage, truncated: snap.retention.truncated }
      : {
          // No capture has run, so nothing is known about realized writes.
          completeFromTreeStart: false,
          scopeIntegrity: 'complete',
          startedAtSequence: 0,
          truncated: false,
        },
  };
}

// ── rendering ────────────────────────────────────────────────────────────────

function renderHeader(): HTMLElement {
  const bar = el('div', 'topbar');
  bar.append(el('span', 'brand', 'SignalTree Studio'));
  const state =
    realization?.support === 'supported' && realization.capture === 'active'
      ? 'LIVE'
      : connected
        ? 'IDLE'
        : 'NO BRIDGE';
  bar.append(el('span', `badge ${state === 'LIVE' ? 'on' : ''}`, state));
  return bar;
}

function renderTrees(): HTMLElement {
  const pane = el('div', 'pane');
  pane.append(el('h2', undefined, 'Trees'));
  const ul = el('ul');
  for (const tree of trees) {
    const li = el('li');
    const b = el('button', undefined, tree.label ?? tree.id) as HTMLButtonElement;
    b.append(el('div', 'cap', tree.capabilities.length ? tree.capabilities.join(', ') : '—'));
    b.setAttribute('aria-current', String(tree.id === selected?.id));
    b.onclick = () => {
      selected = tree;
      // Evidence is tree-scoped; carrying another tree's snapshot across would
      // be exactly the cross-tree confusion the id namespace exists to prevent.
      held = undefined;
      openEvidence = undefined;
      currentValue = undefined;
      void refresh();
    };
    li.append(b);
    ul.append(li);
  }
  pane.append(ul);
  return pane;
}

/**
 * ⚠️ THREE DISTINCT STATES, NEVER COLLAPSED. "This composition cannot observe",
 * "observation available, not recording" and "recording, nothing seen yet" are
 * three different truths and only the last may read as "no realizations".
 */
function renderCapture(treeId: string): HTMLElement {
  const box = el('div', 'section');
  box.append(el('h2', undefined, 'Realization capture'));

  if (!realization) {
    box.append(el('p', 'muted', 'Unknown — the tree did not answer.'));
    return box;
  }

  if (realization.support === 'unsupported') {
    box.append(
      el('p', 'muted', '○ UNAVAILABLE'),
      el(
        'p',
        'muted',
        'This tree composition cannot provide complete leaf observation, so Studio refuses rather than showing partial coverage.'
      )
    );
    return box;
  }

  if (realization.capture === 'inactive') {
    box.append(el('p', 'muted', '○ INACTIVE'));
    const start = el('button', 'action', 'Start Capture') as HTMLButtonElement;
    start.onclick = async () => {
      await send('startRealizationCapture', { treeId, maxEffects: 500 });
      await refresh();
    };
    box.append(start);
    if (held) {
      box.append(
        el('p', 'muted', `Holding ${held.effects.length} effect(s) from a stopped session.`)
      );
    }
    return box;
  }

  const s = realization.snapshot;
  box.append(el('p', 'live', '● ACTIVE'));
  const stop = el('button', 'action', 'Stop Capture') as HTMLButtonElement;
  stop.onclick = async () => {
    // The bridge snapshots before disposing; keep it so the investigation
    // survives the recorder.
    const res = await send<{ stopped: boolean; snapshot?: CaptureSnapshot }>(
      'stopRealizationCapture',
      { treeId }
    );
    held = res?.snapshot ?? held;
    await refresh();
  };
  box.append(stop);
  box.append(
    el('p', 'muted', `${s.retention.retained} effect(s) retained`),
    el('p', 'muted', `Integrity: ${s.coverage.scopeIntegrity}`)
  );
  if (s.retention.truncated) {
    box.append(el('p', 'warn', '⚠ Earlier captured evidence has been evicted.'));
  }
  return box;
}

function renderPathPicker(): HTMLElement {
  const box = el('div', 'section');
  box.append(el('h2', undefined, 'Path'));
  const form = el('form', 'pathrow') as HTMLFormElement;
  const input = el('input') as HTMLInputElement;
  input.value = pathDraft;
  input.placeholder = 'cart.total';
  input.oninput = () => {
    pathDraft = input.value;
  };
  const go = el('button', 'action', 'Why?') as HTMLButtonElement;
  go.type = 'submit';
  form.onsubmit = (e) => {
    e.preventDefault();
    path = pathDraft.trim();
    openEvidence = undefined;
    void refresh();
  };
  form.append(input, go);
  box.append(form);

  // Paths the retained evidence already mentions — a convenience, not a state
  // tree. A real picker needs structure Studio does not yet read.
  const known = [
    ...new Set([
      ...turns.flatMap((t) => t.effects.map((e) => e.path)),
      ...(snapshot()?.effects ?? []).map((e) => e.path),
    ]),
  ];
  if (known.length) {
    const ul = el('ul', 'paths');
    for (const p of known) {
      const li = el('li');
      const b = el('button', undefined, p) as HTMLButtonElement;
      b.setAttribute('aria-current', String(p === path));
      b.onclick = () => {
        path = pathDraft = p;
        openEvidence = undefined;
        void refresh();
      };
      li.append(b);
      ul.append(li);
    }
    box.append(ul);
  }
  return box;
}

function renderWhy(view: WhyView, treeId: string): HTMLElement {
  const box = el('div', 'section');
  box.append(el('h2', undefined, 'Current value'), el('div', 'value', view.currentValue));
  if (!view.currentValueExplained) {
    box.append(el('p', 'warn', '⚠ The current value is not explained by retained evidence.'));
  }

  box.append(el('h2', 'whyhead', 'Why?'));
  if (view.lines.length === 0) {
    box.append(el('p', 'muted', 'No retained evidence mentions this path.'));
    return box;
  }

  for (const line of view.lines) {
    const claim = el('div', `claim ${line.classification}`);
    claim.append(
      el('div', 'class', line.classification.toUpperCase()),
      el('div', 'text', line.text)
    );
    for (const ref of line.evidence) {
      const b = el('button', 'ref', ref) as HTMLButtonElement;
      b.setAttribute('aria-expanded', String(openEvidence === ref));
      b.onclick = () => {
        openEvidence = openEvidence === ref ? undefined : ref;
        paint();
      };
      claim.append(b);
    }
    box.append(claim);
    if (openEvidence && line.evidence.includes(openEvidence)) {
      box.append(renderEvidence(openEvidence, treeId));
    }
  }
  return box;
}

/**
 * The evidence drawer: the raw normalized record behind one reference.
 *
 * ⚠️ Shows what was RETAINED, verbatim. It never re-derives, re-orders or
 * summarizes — this is the first interaction model for the eventual causal
 * view, and it earns trust only by being literal.
 */
function renderEvidence(ref: string, treeId: string): HTMLElement {
  const box = el('div', 'detail');
  box.append(el('h2', undefined, ref));
  const [kind, , id] = ref.split(':');
  const set = evidenceSet(treeId);
  const record: unknown =
    kind === 'realization'
      ? set.realizations.find((r) => String(r.sequence) === id)
      : set.transactions.find((t) => String(t.turnId) === id);

  if (!record) {
    box.append(el('p', 'muted', 'This record is no longer retained.'));
    return box;
  }
  for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
    if (k === 'kind' || k === 'treeId') continue;
    const row = el('div', 'row');
    row.append(el('span', 'k', k), el('span', 'v', JSON.stringify(v)));
    box.append(row);
  }
  return box;
}

function renderEmpty(): HTMLElement {
  const pane = el('div', 'pane empty');
  pane.append(
    el('h2', undefined, connected ? 'No tree attached' : 'No Studio-enabled SignalTree found'),
    el(
      'p',
      'muted',
      connected
        ? 'The Studio bridge is installed on this page, but no tree has been attached. Call attachStudio(tree) in development.'
        : 'Studio reads only trees an application explicitly attaches in development. Import installStudioBridge from @signal-tree/studio-adapter/bridge, call it, then attachStudio(tree).'
    )
  );
  // "Bridge installed, nothing attached" and "no Studio at all" are different
  // facts, and the panel must not blur them into one empty state.
  return pane;
}

function paint() {
  root.replaceChildren();
  root.append(renderHeader());
  const body = el('div', 'body');

  if (!selected) {
    body.append(renderEmpty());
    root.append(body);
    return;
  }

  body.append(renderTrees());

  const detail = el('div', 'pane');
  detail.append(el('div', 'treename', selected.label ?? selected.id));
  detail.append(renderCapture(selected.id));
  detail.append(renderPathPicker());
  if (path) {
    detail.append(
      renderWhy(
        whyValue(evidenceSet(selected.id), path, currentValue ?? { kind: 'value', value: undefined }),
        selected.id
      )
    );
  }
  if (lastError) {
    detail.append(
      el(
        'p',
        'warn',
        `${lastError.code}${lastError.capability ? ` (${lastError.capability})` : ''}`
      )
    );
  }
  body.append(detail);
  root.append(body);
}

async function refresh() {
  lastError = undefined;
  connected = (await send<{ protocol: number }>('hello')) !== undefined;
  if (!connected) {
    trees = [];
    selected = undefined;
    paint();
    return;
  }

  trees = (await send<Tree[]>('listTrees')) ?? [];
  selected = trees.find((t) => t.id === selected?.id) ?? trees[0];
  if (!selected) {
    paint();
    return;
  }

  const confirmed = await send<TurnRead>('readConfirmedTurns', { treeId: selected.id });
  turns = confirmed?.turns ?? [];
  realization = await send<RealizationRead>('readRealizations', { treeId: selected.id });

  if (path) {
    // ⚠️ LIVE. Never `latestRealization.after`.
    currentValue = await send<CapturedValue>('readCurrentValue', {
      treeId: selected.id,
      path,
    });
  }
  paint();
}

void refresh();
setInterval(() => void refresh(), 1500);
