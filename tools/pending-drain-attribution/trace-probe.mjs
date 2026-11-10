// Diagnostic-only scalar state. No library source/packet/owner/callback registry.
const counters = new Map(), phases = new Map(), schedulers = new Map();
let activePhase = 'unassigned', events = [], eventLimit = 128, droppedEvents = 0;
let objectHandles = new WeakMap();
const totals = { scheduled: 0, executed: 0, cancelled: 0, failedScheduling: 0, current: 0, maxQueue: 0 };
const numericHandles = new Map();
function increment(table, label, amount = 1) { table.set(label, (table.get(label) ?? 0) + amount); }
function event(kind, label) {
  if (events.length < eventLimit) events.push({ kind, label, phase: activePhase }); else droppedEvents++;
}
export function hit(label, ...numbers) {
  if (typeof label !== 'string' || numbers.some(value => typeof value !== 'number' || !Number.isFinite(value))) throw new TypeError('Probe accepts string labels and finite numeric metadata only');
  increment(counters, label);
  let table = phases.get(activePhase); if (!table) phases.set(activePhase, table = new Map());
  increment(table, label);
  for (let i = 0; i < numbers.length; i++) { increment(counters, `${label}.sum${i}`, numbers[i]); increment(table, `${label}.sum${i}`, numbers[i]); }
}
export function phase(name) { if (typeof name !== 'string') throw new TypeError('Phase must be a string'); activePhase = name; event('phase', name); }
function bucket(label, kind) {
  const key = `${kind}:${label}`;
  let state = schedulers.get(key);
  if (!state) schedulers.set(key, state = { label, kind, scheduled: 0, executed: 0, cancelled: 0, failedScheduling: 0, current: 0, maxQueue: 0 });
  return state;
}
function handleRecord(handle) { return handle !== null && (typeof handle === 'object' || typeof handle === 'function') ? objectHandles.get(handle) : numericHandles.get(handle); }
function remember(handle, record) {
  if (handle !== null && (typeof handle === 'object' || typeof handle === 'function')) objectHandles.set(handle, record);
  else if (typeof handle === 'number') { numericHandles.set(handle, record); record.numericHandle = handle; }
}
function finish(record, status) {
  if (!record.active) return;
  record.active = false; record.bucket.current--; record.bucket[status]++; totals.current--; totals[status]++;
  if (record.numericHandle !== undefined) numericHandles.delete(record.numericHandle);
  hit(`scheduler.${status}:${record.bucket.kind}:${record.bucket.label}`); event(status, `${record.bucket.kind}:${record.bucket.label}`);
}
/** Original callback arguments, this, exceptions and return handle are preserved. */
export function schedule(label, kind, receiver, original, ...args) {
  if (!['queueMicrotask', 'setTimeout', 'setImmediate'].includes(kind) || typeof label !== 'string') throw new TypeError('Invalid diagnostic scheduler');
  // Delegate invalid callback handling to the original host API.
  if (typeof args[0] !== 'function') return Reflect.apply(original, receiver, args);
  const state = bucket(label, kind), record = { bucket: state, active: true };
  state.scheduled++; state.current++; state.maxQueue = Math.max(state.maxQueue, state.current);
  totals.scheduled++; totals.current++; totals.maxQueue = Math.max(totals.maxQueue, totals.current);
  hit(`scheduler.scheduled:${kind}:${label}`); event('scheduled', `${kind}:${label}`);
  const callback = args[0];
  args[0] = function (...callbackArgs) { finish(record, 'executed'); return Reflect.apply(callback, this, callbackArgs); };
  try { const handle = Reflect.apply(original, receiver, args); if (kind !== 'queueMicrotask' && record.active) remember(handle, record); return handle; }
  catch (error) { if (record.active) { record.active = false; state.current--; state.failedScheduling++; totals.current--; totals.failedScheduling++; } throw error; }
}
export function cancel(label, kind, receiver, original, ...args) {
  const result = Reflect.apply(original, receiver, args), record = handleRecord(args[0]);
  if (record) finish(record, 'cancelled');
  hit(`scheduler.cancelCall:${kind}:${label}`); return result;
}
export function snapshot() {
  return { phase: activePhase, schedulerTotals: { ...totals }, counters: Object.fromEntries(counters), phases: Object.fromEntries([...phases].map(([name, table]) => [name, Object.fromEntries(table)])),
    schedulers: [...schedulers.values()].map(state => ({ ...state })), events: events.map(value => ({ ...value })), droppedEvents };
}
export function reset({ maxEvents = 128 } = {}) {
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 0) throw new TypeError('Invalid event limit');
  if ([...schedulers.values()].some(state => state.current !== 0)) throw new Error('Cannot reset while instrumented tasks remain queued');
  counters.clear(); phases.clear(); schedulers.clear(); numericHandles.clear(); objectHandles = new WeakMap();
  for (const key of Object.keys(totals)) totals[key] = 0;
  activePhase = 'unassigned'; events = []; eventLimit = maxEvents; droppedEvents = 0;
}
/** Three-write positive calibration; removing Source.complete injection must fail. */
export function assertPointCalibration(report, { candidate, writes = 3 } = {}) {
  if (!Number.isSafeInteger(writes) || writes < 1) throw new TypeError('Invalid calibration write count');
  const required = { 'Source.prepare': writes, 'Source.complete': writes, [candidate ? 'Native.preparePoint' : 'Native.prepare']: writes, 'Native.complete': writes };
  for (const [label, expected] of Object.entries(required)) if (report.counters[label] !== expected) throw new Error(`Trace calibration ${label}: expected ${expected}, got ${report.counters[label] ?? 0}`);
  return { passed: true, candidate: !!candidate, writes, required };
}
