export const ALL_ARMS = [
  'signals',
  'ngrx',
  'st14',
  'st15-released',
  'st15-candidate',
];

export function parseArgs(argv) {
  const raw = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument: ${a}`);
    const eq = a.indexOf('=');
    const name = eq >= 0 ? a.slice(2, eq) : a.slice(2);
    if (['no-aa', 'quick', 'help'].includes(name)) {
      raw[name] = true;
      continue;
    }
    raw[name] = eq >= 0 ? a.slice(eq + 1) : argv[++i];
    if (raw[name] === undefined) throw new Error(`--${name} needs a value`);
  }
  const known = [
    'rounds',
    'rows',
    'cpu',
    'arms',
    'no-aa',
    'out',
    'quick',
    'root',
    'timeout',
    'help',
  ];
  for (const k of Object.keys(raw))
    if (!known.includes(k)) throw new Error(`unknown option --${k}`);
  const quick = !!raw.quick;
  const posInt = (v, name) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1)
      throw new Error(`--${name} must be a positive integer`);
    return n;
  };
  const rounds =
    raw.rounds !== undefined ? posInt(raw.rounds, 'rounds') : quick ? 1 : 5;
  const rows =
    raw.rows !== undefined
      ? raw.rows
          .split(',')
          .map((x) => posInt(x, 'rows'))
          .sort((a, b) => a - b)
      : quick
      ? [1000]
      : [1000, 10000, 50000];
  if (new Set(rows).size !== rows.length)
    throw new Error('--rows has duplicates');
  const cpu = raw.cpu !== undefined ? Number(raw.cpu) : null;
  if (cpu !== null && !(cpu >= 1)) throw new Error('--cpu must be >= 1');
  const arms = raw.arms
    ? raw.arms.split(',').map((s) => s.trim())
    : [...ALL_ARMS];
  for (const a of arms)
    if (!ALL_ARMS.includes(a))
      throw new Error(`unknown arm ${a} (known: ${ALL_ARMS.join(', ')})`);
  if (new Set(arms).size !== arms.length)
    throw new Error('--arms has duplicates');
  return {
    help: !!raw.help,
    quick,
    rounds,
    rows,
    cpu,
    arms,
    aa: !raw['no-aa'],
    out: raw.out ?? null,
    root: raw.root ?? null,
    timeoutMs: raw.timeout ? posInt(raw.timeout, 'timeout') : 120_000,
    counts: quick
      ? { edits: 20, burst: 20, move: 10, warm: 3, measured: 3 }
      : { edits: 200, burst: 100, move: 50, warm: 30, measured: 20 },
  };
}
