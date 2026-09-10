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
 *     THE EXPLANATION IS THE PRODUCT. CAPTURE CONTROLS ARE CHROME.
 *
 * ⚠️ THE LAYOUT IS A CORRECTNESS CONCERN, NOT A TASTE ONE. The first working
 * version stacked capture controls, a path picker and the current value ABOVE
 * the explanation; measured in a real 620px panel, WHY? began at y≈475 and the
 * DERIVED and UNKNOWN lines were never on screen. A product whose primary
 * answer is below the fold is subordinating the answer to its own setup.
 *
 *     STATE          WHY?                     EVIDENCE
 *     what exists    the claim, ranked        the record behind the claim
 *
 * ⚠️ The shell still computes NO semantics. `whyValue` classifies every line
 * and attaches its evidence; nothing here decides what is a FACT and nothing
 * draws a causal arrow. The current value is a LIVE read, never
 * `latestRealization.after` — sourcing it from the evidence would make
 * "explained by retained evidence" true by construction.
 */

type Tree = { id: string; label?: string; capabilities: readonly string[] };

type StateNode = {
  key: string;
  path: string;
  kind: 'branch' | 'leaf';
  children?: StateNode[];
  truncated?: 'depth' | 'breadth';
};
type StateShapeResult =
  | { ok: true; shape: { nodes: StateNode[]; truncated: boolean } }
  | { ok: false; reason: string };

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
 * only truthful reading of that is "no Studio here" — not a spinner waiting for
 * an event that cannot arrive.
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
let stateShape: StateShapeResult | undefined;
const collapsed = new Set<string>();
let realization: RealizationRead | undefined;
/**
 * ⚠️ SURVIVES STOP. The recorder releases its retained evidence on dispose; the
 * investigation does not end because recording did.
 */
let held: CaptureSnapshot | undefined;
let turns: TurnRead['turns'] = [];
let currentValue: CapturedValue | undefined;
/** Which evidence record the EVIDENCE column is illuminating. */
let focused: string | undefined;
let showRaw = false;
let lastError: { code: string; capability?: string } | undefined;

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const snapshot = (): CaptureSnapshot | undefined =>
  realization?.support === 'supported' && realization.capture === 'active'
    ? realization.snapshot
    : held;

const capturing = () =>
  realization?.support === 'supported' && realization.capture === 'active';

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
          completeFromTreeStart: false,
          scopeIntegrity: 'complete',
          startedAtSequence: 0,
          truncated: false,
        },
  };
}

/** `realization:tree-0001:0` / `transaction:tree-0001:2` -> the record. */
function evidenceRecord(ref: string, treeId: string): Record<string, unknown> | undefined {
  const [kind, , id] = ref.split(':');
  const set = evidenceSet(treeId);
  const found =
    kind === 'realization'
      ? set.realizations.find((r) => String(r.sequence) === id)
      : set.transactions.find((t) => String(t.turnId) === id);
  return found as Record<string, unknown> | undefined;
}

// ── chrome: the top bar ──────────────────────────────────────────────────────

function renderTopBar(): HTMLElement {
  const bar = el('div', 'topbar');
  bar.append(el('span', 'brand', 'SIGNALTREE STUDIO'));

  const right = el('div', 'topright');
  const state = capturing() ? 'LIVE' : connected ? 'IDLE' : 'NO BRIDGE';
  right.append(el('span', `badge ${capturing() ? 'on' : ''}`, `● ${state}`));

  if (trees.length > 1) {
    const picker = el('select', 'treepick') as HTMLSelectElement;
    for (const t of trees) {
      const o = el('option', undefined, t.label ?? t.id) as HTMLOptionElement;
      o.value = t.id;
      o.selected = t.id === selected?.id;
      picker.append(o);
    }
    picker.onchange = () => {
      selected = trees.find((t) => t.id === picker.value);
      // Evidence and structure are tree-scoped; carrying either across trees is
      // the cross-tree confusion the id namespace exists to prevent.
      held = undefined;
      focused = undefined;
      path = '';
      stateShape = undefined;
      currentValue = undefined;
      void refresh();
    };
    right.append(picker);
  } else if (selected) {
    right.append(el('span', 'treename', selected.label ?? selected.id));
  }

  // ⚠️ Capture is chrome, but it is still EXPLICIT. Nothing records because
  // DevTools opened; a person asks for it, here.
  right.append(renderCaptureControl());
  bar.append(right);
  return bar;
}

function renderCaptureControl(): HTMLElement {
  const wrap = el('span', 'capturectl');
  if (!selected || !realization) {
    return wrap;
  }
  if (realization.support === 'unsupported') {
    const tag = el('span', 'badge muted', '○ NO CAPTURE');
    tag.title =
      'This tree composition cannot provide complete leaf observation, so Studio refuses rather than showing partial coverage.';
    wrap.append(tag);
    return wrap;
  }
  const treeId = selected.id;
  if (realization.capture === 'inactive') {
    const b = el('button', 'action', 'Start Capture') as HTMLButtonElement;
    b.onclick = async () => {
      await send('startRealizationCapture', { treeId, maxEffects: 500 });
      await refresh();
    };
    wrap.append(el('span', 'badge muted', '○ INACTIVE'), b);
    return wrap;
  }
  const s = realization.snapshot;
  const b = el('button', 'action', 'Stop Capture') as HTMLButtonElement;
  b.onclick = async () => {
    const res = await send<{ snapshot?: CaptureSnapshot }>('stopRealizationCapture', { treeId });
    held = res?.snapshot ?? held;
    await refresh();
  };
  wrap.append(el('span', 'badge on', `● CAPTURE ${s.retention.retained}`), b);
  return wrap;
}

// ── column 1: STATE ──────────────────────────────────────────────────────────

/**
 * ⚠️ THE STATE, NOT THE EVIDENCE. These names come from `readStateShape`, so a
 * location nothing has written to still appears. Listing only paths mentioned
 * by retained evidence would present a partial tree as the application's state.
 */
function renderState(): HTMLElement {
  const pane = el('div', 'pane state');
  pane.append(el('h2', undefined, 'State'));

  if (!stateShape) {
    pane.append(el('p', 'muted', 'Reading…'));
    return pane;
  }
  if (!stateShape.ok) {
    pane.append(el('p', 'warn', `Structure unavailable: ${stateShape.reason}`));
    return pane;
  }

  const list = (nodes: StateNode[], depth: number): HTMLElement => {
    const ul = el('ul', 'tree');
    for (const node of nodes) {
      const li = el('li');
      const isOpen = !collapsed.has(node.path);
      const row = el('button', 'node') as HTMLButtonElement;
      row.style.paddingLeft = `${6 + depth * 12}px`;
      row.setAttribute('aria-current', String(node.path === path));

      const marker =
        node.kind === 'leaf' ? '·' : node.truncated === 'depth' ? '⋯' : isOpen ? '▾' : '▸';
      row.append(el('span', 'marker', marker), el('span', 'key', node.key));
      if (node.truncated === 'depth') {
        // Bounded, and it says so — never silently rendered as a leaf.
        row.title = 'Not enumerated: depth limit. This branch has more inside it.';
      }
      row.onclick = () => {
        if (node.kind === 'branch' && node.children) {
          if (isOpen) collapsed.add(node.path);
          else collapsed.delete(node.path);
        }
        // Selection drives the answer; every node is askable.
        path = node.path;
        focused = undefined;
        void refresh();
      };
      li.append(row);
      if (node.children && isOpen) {
        li.append(list(node.children, depth + 1));
      }
      ul.append(li);
    }
    return ul;
  };

  pane.append(list(stateShape.shape.nodes, 0));
  if (stateShape.shape.truncated) {
    pane.append(el('p', 'muted small', '⋯ some branches were not enumerated (bounded read).'));
  }
  return pane;
}

// ── column 2: WHY? ───────────────────────────────────────────────────────────

function renderWhy(view: WhyView, treeId: string): HTMLElement {
  const pane = el('div', 'pane why');
  pane.append(el('h2', undefined, 'Why?'));
  pane.append(el('div', 'subject', view.path));

  /**
   * The transition that produced what is on screen.
   *
   * ⚠️ THE GLYPH IS A CLAIM, AND IT OBEYS THE SAME RULE AS THE PROSE. Drawing
   * an edge from the last retained realization up to the current value asserts
   * that realization produced it. When the live value has since diverged that
   * is FALSE, and a first version drew it anyway: after Stop, with the tree at
   * 9950, it rendered `9950 ◉ │ 9800 → 10200` — a causal arrow the query had
   * explicitly declined to draw, sitting directly above the warning saying so.
   *
   * The edge is therefore drawn ONLY when `currentValueExplained` holds. When
   * it does not, the connector is severed and the transition is labelled as
   * merely the last thing retained.
   */
  const latest = snapshot()?.effects.filter((e) => e.path === view.path).at(-1);
  const render = (v: { kind: string; value?: unknown }) =>
    v.kind === 'value' ? JSON.stringify(v.value) : '?';
  const glyph = el('div', 'glyph');
  glyph.append(el('div', 'now', view.currentValue));

  if (latest && view.currentValueExplained) {
    glyph.append(
      el('div', 'stem', '◉'),
      el('div', 'edge', latest.origin ? `${latest.origin} realization` : 'realization'),
      el('div', 'stem', '│'),
      el('div', 'from', `${render(latest.before)} → ${render(latest.after)}`)
    );
  } else if (latest) {
    glyph.append(
      el('div', 'stem severed', '⌁'),
      el('div', 'edge muted', 'last retained transition — does not explain this value'),
      el('div', 'from muted', `${render(latest.before)} → ${render(latest.after)}`)
    );
  } else {
    glyph.append(el('div', 'stem', '◉'));
  }
  pane.append(glyph);

  if (!view.currentValueExplained) {
    pane.append(el('p', 'warn', '⚠ The current value is not explained by retained evidence.'));
  }

  if (view.lines.length === 0) {
    pane.append(el('p', 'muted', 'No retained evidence mentions this path.'));
    return pane;
  }

  for (const line of view.lines) {
    const claim = el('div', `claim ${line.classification}`);
    if (line.evidence.some((r) => r === focused)) {
      claim.classList.add('focused');
    }
    claim.append(
      el('div', 'class', line.classification.toUpperCase()),
      el('div', 'text', line.text)
    );
    for (const ref of line.evidence) {
      const b = el('button', 'ref', ref) as HTMLButtonElement;
      b.setAttribute('aria-pressed', String(focused === ref));
      // ⚠️ The first genuine causal-graph behaviour, with no graph engine:
      // a claim and its record are two ends of one edge, and clicking one
      // illuminates the other.
      b.onclick = () => {
        focused = focused === ref ? undefined : ref;
        paint();
      };
      claim.append(b);
    }
    pane.append(claim);
  }
  return pane;
}

// ── column 3: EVIDENCE ───────────────────────────────────────────────────────

function renderEvidence(view: WhyView, treeId: string): HTMLElement {
  const pane = el('div', 'pane evidence');
  pane.append(el('h2', undefined, 'Evidence'));

  pane.append(el('div', 'label', 'Current'), el('div', 'value', view.currentValue));

  const set = evidenceSet(treeId);
  const cards: { ref: string; head: string; body: string[] }[] = [];

  for (const t of set.transactions) {
    const hit = t.effects.find((e) => e.path === view.path);
    if (!hit) continue;
    cards.push({
      ref: `transaction:${treeId}:${t.turnId}`,
      head: `T${t.turnId}  committed`,
      body: [`${view.path}`, `${JSON.stringify(hit.before)} → ${JSON.stringify(hit.after)}`],
    });
  }
  for (const r of set.realizations) {
    if (r.path !== view.path) continue;
    cards.push({
      ref: `realization:${treeId}:${r.sequence}`,
      head: `R${r.sequence}  realization`,
      body: [
        r.origin ?? 'origin unknown',
        `${r.before.kind === 'value' ? JSON.stringify(r.before.value) : '?'} → ${
          r.after.kind === 'value' ? JSON.stringify(r.after.value) : '?'
        }`,
      ],
    });
  }

  for (const card of cards) {
    const box = el('div', 'card');
    if (card.ref === focused) box.classList.add('focused');
    box.append(el('div', 'cardhead', card.head));
    for (const line of card.body) box.append(el('div', 'cardline', line));
    box.onclick = () => {
      focused = focused === card.ref ? undefined : card.ref;
      paint();
    };
    pane.append(box);
  }

  // ⚠️ Coverage is STATED, never footnoted. Absence is not evidence.
  pane.append(el('div', 'label', 'Coverage'));
  const cov = el('div', 'coverage');
  cov.append(el('div', 'cardline', 'began after startup'));
  if (set.coverage.scopeIntegrity !== 'complete') {
    cov.append(el('div', 'cardline warn', 'some writes unassignable to this tree'));
  }
  if (set.coverage.truncated) {
    cov.append(el('div', 'cardline warn', 'earlier evidence evicted'));
  }
  if (!capturing()) {
    cov.append(
      el(
        'div',
        'cardline',
        held ? `not recording — holding ${held.effects.length}` : 'not recording'
      )
    );
  }
  pane.append(cov);

  const toggle = el('button', 'action wide', showRaw ? 'Hide raw evidence' : 'Raw evidence') as HTMLButtonElement;
  toggle.onclick = () => {
    showRaw = !showRaw;
    paint();
  };
  pane.append(toggle);

  if (showRaw) {
    const ref = focused ?? cards.at(-1)?.ref;
    const record = ref && evidenceRecord(ref, treeId);
    const raw = el('div', 'raw');
    if (!record) {
      raw.append(el('div', 'cardline muted', 'No record selected.'));
    } else {
      raw.append(el('div', 'cardhead', ref as string));
      for (const [k, v] of Object.entries(record)) {
        if (k === 'kind' || k === 'treeId') continue;
        const row = el('div', 'row');
        row.append(el('span', 'k', k), el('span', 'v', JSON.stringify(v)));
        raw.append(row);
      }
    }
    pane.append(raw);
  }
  return pane;
}

// ── the semantic time strip ──────────────────────────────────────────────────

/**
 * ⚠️ ORDER OF RECORD, NOT A CAUSAL CHAIN. Transactions are ordered by turn id
 * and realizations by capture sequence; the strip places them left to right and
 * asserts nothing about one causing another (SUPERSESSION-0: WEAK).
 */
function renderTimeStrip(view: WhyView, treeId: string): HTMLElement {
  const strip = el('div', 'timestrip');
  strip.append(el('span', 'label', 'semantic time'));
  const set = evidenceSet(treeId);
  const marks: { ref: string; label: string }[] = [
    ...set.transactions
      .filter((t) => t.effects.some((e) => e.path === view.path))
      .map((t) => ({ ref: `transaction:${treeId}:${t.turnId}`, label: `T${t.turnId}` })),
    ...set.realizations
      .filter((r) => r.path === view.path)
      .map((r) => ({ ref: `realization:${treeId}:${r.sequence}`, label: `R${r.sequence}` })),
  ];

  for (const m of marks) {
    const b = el('button', 'mark', m.label) as HTMLButtonElement;
    if (m.ref === focused) b.classList.add('focused');
    b.onclick = () => {
      focused = focused === m.ref ? undefined : m.ref;
      paint();
    };
    strip.append(b, el('span', 'rule', '─────'));
  }
  strip.append(el('span', `mark now${view.currentValueExplained ? '' : ' warn'}`, 'NOW'));
  return strip;
}

// ── assembly ─────────────────────────────────────────────────────────────────

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
  return pane;
}

function paint() {
  root.replaceChildren();
  root.append(renderTopBar());

  if (!selected) {
    root.append(renderEmpty());
    return;
  }

  const view = whyValue(
    evidenceSet(selected.id),
    path,
    currentValue ?? { kind: 'value', value: undefined }
  );

  const body = el('div', 'body');
  body.append(renderState());
  if (path) {
    body.append(renderWhy(view, selected.id), renderEvidence(view, selected.id));
  } else {
    const hint = el('div', 'pane why');
    hint.append(el('h2', undefined, 'Why?'), el('p', 'muted', 'Select a location in State.'));
    body.append(hint, el('div', 'pane evidence'));
  }
  root.append(body);

  if (path) {
    root.append(renderTimeStrip(view, selected.id));
  }
  if (lastError) {
    root.append(
      el('div', 'errbar', `${lastError.code}${lastError.capability ? ` (${lastError.capability})` : ''}`)
    );
  }
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
  stateShape = await send<StateShapeResult>('readStateShape', { treeId: selected.id });

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
