import { median, mean, spread } from './stats.mjs';
import { EDIT_KINDS } from './session.mjs';

/** Flatten one arm's data for one round into { metricKey: number }. */
export function roundMetrics(data) {
  const m = {};
  const su = data?.startup;
  if (su) {
    m['st.jsKB'] = su.jsBytesGzip / 1024;
    m['st.scriptMs'] = su.scriptDurationMs;
    m['st.taskMs'] = su.taskDurationMs;
  }
  const grid = data?.grid;
  if (grid) {
    const ns = Object.keys(grid)
      .map(Number)
      .sort((a, b) => a - b);
    for (const n of ns) {
      const g = grid[n],
        k = `n${n}`;
      m[`${k}.load`] = g.load.ms;
      m[`${k}.refetch`] = g.refetch.ms;
      for (const kind of EDIT_KINDS) {
        const e = g.edits[kind];
        m[`${k}.edit.${kind}.p50`] = e.p50;
        m[`${k}.edit.${kind}.p95`] = e.p95;
        m[`${k}.edit.${kind}.p99`] = e.p99;
        m[`${k}.rows.${kind}`] = e.counters.rows / e.ms.length;
      }
      m[`${k}.burst`] = g.burst.ms;
      m[`${k}.burstRows`] = g.burst.counters.rows;
      m[`${k}.move.p95`] = g.move.p95;
      m[`${k}.remove.p95`] = g.remove.p95;
      m[`${k}.dom.nodes`] = g.dom.nodes;
      m[`${k}.dom.listeners`] = g.dom.listeners;
      // Leaving the route should release the store: heap after teardown vs before the load.
      m[`${k}.retainedKB`] = (g.heap.end - g.heap.baseline) / 1024;
    }
    const d = (n) => grid[n].heap.afterLoad - grid[n].heap.baseline;
    if (ns.length >= 2) {
      const lo = ns[0],
        hi = ns[ns.length - 1];
      m['grid.bytesPerRow'] = (d(hi) - d(lo)) / (hi - lo);
    } else if (ns.length === 1) {
      m['grid.bytesPerRowGross'] = d(ns[0]) / ns[0];
    }
  }
  const ed = data?.editors;
  if (ed) {
    m['ed.open.p50'] = ed.open.p50;
    m['ed.open.p95'] = ed.open.p95;
    m['ed.close.p50'] = ed.close.p50;
    m['ed.close.p95'] = ed.close.p95;
    if (ed.edit) {
      m['ed.edit.p50'] = ed.edit.p50;
      m['ed.edit.p95'] = ed.edit.p95;
    }
    m['ed.bytesPerCycle'] = ed.bytesPerCycle;
    m['ed.appBytesPerCycle'] = ed.appBytesPerCycle;
    m['ed.appOneTimeKB'] = ed.appOneTimeBytes / 1024;
    m['ed.codeBytesPerCycle'] = ed.codeBytesPerCycle;
    m['ed.dom.nodes'] = ed.dom.nodes;
    m['ed.dom.listeners'] = ed.dom.listeners;
  }
  return m;
}

/** raw.rounds[r][label] -> summary[label][key] = { values[], median, min, max, n } */
export function summarize(raw) {
  const summary = {};
  for (const label of raw.labels) {
    const byKey = {};
    for (const round of raw.rounds) {
      for (const [key, value] of Object.entries(roundMetrics(round[label])))
        (byKey[key] ??= []).push(value);
    }
    summary[label] = Object.fromEntries(
      Object.entries(byKey).map(([k, v]) => [k, { values: v, ...spread(v) }])
    );
  }
  return summary;
}

/** A/A band per metric: median over rounds of |A - A'| / A. */
export function aaBands(summary, releasedLabel, aaLabel) {
  const a = summary[releasedLabel],
    b = summary[aaLabel];
  if (!a || !b) return null;
  const bands = {};
  for (const key of Object.keys(a)) {
    if (!b[key]) continue;
    const n = Math.min(a[key].values.length, b[key].values.length);
    const diffs = [];
    for (let i = 0; i < n; i++) {
      const x = a[key].values[i],
        y = b[key].values[i];
      if (x !== 0 && Number.isFinite(x) && Number.isFinite(y))
        diffs.push(Math.abs(x - y) / Math.abs(x));
    }
    if (diffs.length) bands[key] = median(diffs);
  }
  return bands;
}

const f2 = (x) =>
  Math.abs(x) >= 100
    ? x.toFixed(0)
    : Math.abs(x) >= 10
    ? x.toFixed(1)
    : x.toFixed(2);
const cell = (s) =>
  s
    ? s.n > 1
      ? `${f2(s.median)} (${f2(s.min)}-${f2(s.max)})`
      : f2(s.median)
    : '-';

export function printReport({
  raw,
  summary,
  bands,
  invalid,
  log = console.log,
}) {
  const { labels, config, environment: env } = raw;
  const banners = [];
  if (raw.development)
    banners.push(
      'DEVELOPMENT RUN (--quick): not a result. Do not quote these numbers.'
    );
  else if (config.rounds < 5)
    banners.push(
      `Only ${config.rounds} round(s): quote nothing from fewer than 5 (METHODOLOGY.md).`
    );
  if (env.busy)
    banners.push(
      `BUSY: load average ${env.loadAverage1m.toFixed(2)} > ${
        env.cpu.cores / 2
      } (cores/2). Development only.`
    );
  if (env.endBusy && !env.busy)
    banners.push(
      `BUSY at end of run: load average ${env.endLoadAverage1m.toFixed(
        2
      )}. Treat as development.`
    );
  if (env.customRoot)
    banners.push(`Custom --root ${env.customRoot}: not the built app.`);
  const bar = '='.repeat(78);
  for (const b of banners) log(`${bar}\n${b}\n${bar}`);

  log('Environment');
  const lib = (k) => env.libraries[k];
  const ver = (k) => (lib(k) ? lib(k).version : 'n/a');
  log(`  node ${env.node} | chromium ${env.chromium} | ${env.os}`);
  log(
    `  cpu ${env.cpu.model} x${env.cpu.cores} | throttle ${
      env.throttle
    } | load1m ${env.loadAverage1m.toFixed(2)}`
  );
  log(
    `  git ${env.git.sha}${
      env.git.dirty ? ' (dirty)' : ''
    } | @angular/core ${ver('@angular/core')}`
  );
  log(
    `  @ngrx/signals ${ver('@ngrx/signals')} | @signaltree/core ${ver(
      '@signaltree/core'
    )}`
  );
  log(
    `  st15-released ${ver('st15-released')} (kernel ${
      lib('st15-released')?.kernel?.version ?? 'n/a'
    })`
  );
  log(
    `  st15-candidate ${ver('st15-candidate')} (kernel ${
      lib('st15-candidate')?.kernel?.version ?? 'n/a'
    })` +
      (env.candidate
        ? ` sha256 angular ${env.candidate.angular.sha256.slice(
            0,
            12
          )} kernel ${env.candidate.kernel.sha256.slice(0, 12)}`
        : '')
  );
  log(
    `  rounds ${config.rounds} | rows ${config.rows.join(
      ','
    )} | counts ${JSON.stringify(config.counts)} | arm order rotates per round`
  );
  log(
    `  cells: median across rounds (min-max across rounds); ms unless noted. '~' = within A/A noise of st15-released`
  );
  log(
    `  heap/DOM deltas: fresh browser context per row count (grid), fresh browser per (round, arm, group)`
  );

  const released = 'st15-released';
  const aa = `${released} (A/A)`;
  const w0 = 44;
  const widths = labels.map((l) => Math.max(l.length, 24));
  const head = (title) => {
    log(`\n${title}`);
    log(
      '  ' +
        ''.padEnd(w0) +
        labels.map((l, i) => l.padEnd(widths[i] + 2)).join('') +
        'A/A band'
    );
  };
  const row = (name, key, { noise = true } = {}) => {
    const cells = labels.map((l, i) => {
      if (invalid[l]) return 'INVALID'.padEnd(widths[i] + 2);
      const s = summary[l][key];
      let text = cell(s);
      if (
        noise &&
        s &&
        bands &&
        summary[released]?.[key] &&
        l !== released &&
        l !== aa
      ) {
        const r = summary[released][key].median;
        if (
          r &&
          bands[key] !== undefined &&
          Math.abs(s.median - r) / Math.abs(r) < bands[key]
        )
          text += ' ~';
      }
      return text.padEnd(widths[i] + 2);
    });
    const band = bands?.[key];
    log(
      '  ' +
        name.padEnd(w0) +
        cells.join('') +
        (band !== undefined ? `${(band * 100).toFixed(1)}%` : '')
    );
  };
  const has = (key) => labels.some((l) => summary[l]?.[key]);

  head('Startup (cache disabled, to a rendered empty grid)');
  row('JS transferred, gzip KB', 'st.jsKB');
  {
    const base = summary.signals?.['st.jsKB']?.median;
    const cells = labels.map((l, i) => {
      const s = summary[l]['st.jsKB'];
      const text = invalid[l]
        ? 'INVALID'
        : base === undefined || !s
        ? 'n/a'
        : `${s.median - base >= 0 ? '+' : ''}${f2(s.median - base)}`;
      return text.padEnd(widths[i] + 2);
    });
    log('  ' + 'delta vs signals arm, KB'.padEnd(w0) + cells.join(''));
  }
  row('ScriptDuration', 'st.scriptMs');
  row('TaskDuration', 'st.taskMs');

  for (const n of config.rows) {
    const k = `n${n}`;
    if (!has(`${k}.load`)) continue;
    head(`Grid, ${n} rows`);
    row('load', `${k}.load`);
    row('refetch (5% changed)', `${k}.refetch`);
    for (const kind of EDIT_KINDS) {
      row(`edit ${kind} p50`, `${k}.edit.${kind}.p50`);
      row(`edit ${kind} p95`, `${k}.edit.${kind}.p95`);
    }
    row(`burst x${config.counts.burst}`, `${k}.burst`);
    row('move p95', `${k}.move.p95`);
    row('remove p95', `${k}.remove.p95`);
    for (const kind of EDIT_KINDS)
      row(`rows rendered / edit, ${kind}`, `${k}.rows.${kind}`, {
        noise: false,
      });
    row('rows rendered in burst', `${k}.burstRows`, { noise: false });
    row('heap retained after teardown, KB', `${k}.retainedKB`);
    row('DOM nodes after teardown', `${k}.dom.nodes`, { noise: false });
    row('listeners after teardown', `${k}.dom.listeners`, { noise: false });
  }
  if (has('grid.bytesPerRow') || has('grid.bytesPerRowGross')) {
    head('Grid memory (retained, after GC)');
    if (has('grid.bytesPerRow'))
      row('bytes/row (slope across row counts)', 'grid.bytesPerRow');
    else
      row('bytes/row (single N, gross: not a slope)', 'grid.bytesPerRowGross');
  }
  if (has('ed.open.p95')) {
    head(
      `Editors (${config.counts.warm} warm-up + ${config.counts.measured} measured cycles, stack of 3)`
    );
    row('open p50', 'ed.open.p50');
    row('open p95', 'ed.open.p95');
    row('field/line edit p50', 'ed.edit.p50');
    row('field/line edit p95', 'ed.edit.p95');
    row('close p50', 'ed.close.p50');
    row('close p95', 'ed.close.p95');
    row(
      `app retained in warm-up 1-${config.counts.warm}, KB`,
      'ed.appOneTimeKB'
    );
    row('app retained after warm-up, B/cycle', 'ed.appBytesPerCycle');
    row('compiled code growth, B/cycle', 'ed.codeBytesPerCycle');
    row('JS heap growth incl. code, B/cycle', 'ed.bytesPerCycle');
    row('DOM nodes after teardown', 'ed.dom.nodes', { noise: false });
    row('listeners after teardown', 'ed.dom.listeners', { noise: false });
  }
  if (!bands)
    log(
      `\nNo A/A control in this run: no noise band available, nothing here can be called a difference.`
    );
  else {
    const headline = [
      'st.jsKB',
      'st.scriptMs',
      ...config.rows.map((n) => `n${n}.load`),
      ...config.rows.map((n) => `n${n}.edit.position-visible.p95`),
      'ed.open.p95',
    ].filter((k) => bands[k] !== undefined);
    log(
      `\nA/A noise band (|A-A'|/A, median across rounds): ` +
        headline.map((k) => `${k} ${(bands[k] * 100).toFixed(1)}%`).join(' | ')
    );
  }
}
