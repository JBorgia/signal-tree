import {
  STATUSES,
  type EditorSeed,
  type Line,
  type Row,
  type Status,
} from '../contract';

/** mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-(seed, index, salt) stream so any row can be generated independently and deterministically. */
function streamFor(seed: number, index: number, salt: number): () => number {
  return mulberry32(
    (seed ^
      Math.imul(index + 1, 0x9e3779b1) ^
      Math.imul(salt + 1, 0x85ebca6b)) >>>
      0
  );
}

const TRUCKS = [
  'T-101',
  'T-102',
  'T-205',
  'T-318',
  'T-427',
  'T-512',
  'T-640',
  'T-777',
];
const DRIVERS = [
  'Alvarez',
  'Brooks',
  'Chen',
  'Diaz',
  'Evans',
  'Foster',
  'Grant',
  'Hughes',
  'Ibarra',
  'Jones',
];
const PLANTS = ['North', 'East', 'South', 'West', 'Central'];
const PRODUCTS = [
  '3000psi',
  '4000psi',
  '5000psi',
  'Fiber mix',
  'Flowable fill',
  'Sand',
  'Gravel #57',
];

export function rowId(index: number): string {
  return 't' + String(index + 1).padStart(6, '0');
}

function pick<T>(list: readonly T[], r: () => number): T {
  return list[Math.floor(r() * list.length)];
}

function baseRow(index: number, seed: number): Row {
  const r = streamFor(seed, index, 0);
  return {
    id: rowId(index),
    ticket: 100000 + index,
    truck: pick(TRUCKS, r),
    driver: pick(DRIVERS, r),
    status: pick(STATUSES, r),
    plant: pick(PLANTS, r),
    product: pick(PRODUCTS, r),
    qty: 1 + Math.floor(r() * 12),
    eta: 5 + Math.floor(r() * 175),
    lat: Math.round((29 + r() * 4) * 1e4) / 1e4,
    lng: -Math.round((95 + r() * 4) * 1e4) / 1e4,
    notes: 'n' + Math.floor(r() * 1000),
  };
}

/** `count` rows. Revision 0 is the initial load; revision r>0 changes rows where index % 20 === r % 20. */
export function generateRows(
  count: number,
  seed: number,
  revision: number
): Row[] {
  const rows: Row[] = new Array(count);
  const slot = revision % 20;
  for (let i = 0; i < count; i++) {
    const base = baseRow(i, seed);
    if (revision > 0 && i % 20 === slot) {
      const r = streamFor(seed, i, revision);
      const next =
        (STATUSES.indexOf(base.status) + 1 + Math.floor(r() * 5)) %
        STATUSES.length;
      rows[i] = {
        ...base,
        status: STATUSES[next],
        eta: base.eta + 200 + revision,
        qty: base.qty + 20 + revision,
      };
    } else {
      rows[i] = base;
    }
  }
  return rows;
}

/** Editor seed: fields from the row, 20 generated lines. */
export function editorSeedFor(
  row: Row,
  seed: number,
  salt: number
): EditorSeed {
  const r = mulberry32((seed ^ Math.imul(salt + 7, 0x27d4eb2f)) >>> 0);
  const lines: Line[] = [];
  for (let i = 0; i < 20; i++) {
    lines.push({
      id: `${row.id}-l${String(i + 1).padStart(2, '0')}`,
      product: pick(PRODUCTS, r),
      qty: 1 + Math.floor(r() * 9),
      price: 10 + Math.floor(r() * 90),
    });
  }
  return {
    rowId: row.id,
    fields: {
      truck: row.truck,
      driver: row.driver,
      status: row.status,
      plant: row.plant,
      product: row.product,
      qty: row.qty,
      eta: row.eta,
      notes: row.notes,
    },
    lines,
  };
}

export function otherStatus(current: Status, step: number): Status {
  const i = STATUSES.indexOf(current);
  return STATUSES[(i + 1 + (step % (STATUSES.length - 1))) % STATUSES.length];
}
