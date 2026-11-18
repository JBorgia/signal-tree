export type Route = 'North' | 'West' | 'East';
export interface Job {
  id: number;
  instance: number;
  driverId: number;
  route: Route;
  status: 'Ready' | 'Shipped';
  priority: boolean;
  revision: number;
}
export interface Driver {
  id: number;
  name: string;
  region: string;
}
export interface Joined extends Job {
  driver: string;
  region: string;
}
export interface RegionCount {
  region: string;
  count: number;
}
export interface View {
  rows: Joined[];
  regions: RegionCount[];
}
export interface ReadModel {
  ready: Promise<void>;
  view(): View;
  job(id: number): Job | undefined;
  updateJob(id: number, change: Partial<Job>): void;
  updateJobs(changes: { id: number; changes: Partial<Job> }[]): void;
  updateDriver(id: number, change: Partial<Driver>): void;
  replaceJob(job: Job): void;
  removeJob(id: number): void;
  destroy(): Promise<void>;
}
export interface Editor {
  read(): Job;
  propose(route: Route): void;
  confirm(): void;
  rollback(): void;
  receive(job: Job): void;
  destroy(): void;
  pending(): boolean;
}
export function seed(size: number): { jobs: Job[]; drivers: Driver[] } {
  if (!Number.isInteger(size) || size < 20)
    throw new Error('Invalid job count');
  const regions = ['North', 'South', 'East', 'West'];
  const drivers = Array.from({ length: Math.ceil(size / 20) }, (_, id) => ({
    id,
    name: `Driver ${id}`,
    region: regions[id % regions.length],
  }));
  const jobs: Job[] = Array.from({ length: size }, (_, id) => ({
    id,
    instance: 1,
    driverId: id % drivers.length,
    route: 'North',
    status: 'Ready',
    priority: id % 3 === 0,
    revision: 0,
  }));
  return { jobs, drivers };
}
export function summarize(rows: Joined[]): View {
  rows.sort((a, b) => a.id - b.id);
  const totals = new Map<string, number>();
  for (const row of rows)
    totals.set(row.region, (totals.get(row.region) ?? 0) + 1);
  return {
    rows,
    regions: [...totals]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => a.region.localeCompare(b.region)),
  };
}
export function domainJob(row: Job): Job {
  return {
    id: row.id,
    instance: row.instance,
    driverId: row.driverId,
    route: row.route,
    status: row.status,
    priority: row.priority,
    revision: row.revision,
  };
}
export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ORACLE:${message}`);
}
export async function settle(): Promise<void> {
  // Both implementations get the same microtask drain. Query readiness is also
  // awaited explicitly; no wall-time sleep is used as a correctness oracle.
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
