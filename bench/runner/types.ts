import type { Capability, StoreSubject, TreeOptions } from '../subjects/types.ts';

export type Variant = NonNullable<TreeOptions['variant']>;

export interface MetricSpec {
  readonly unit: string;
  /** Which direction is a regression; 'none' metrics are recorded but never compared. */
  readonly better: 'lower' | 'higher' | 'none';
  readonly description: string;
  /** Can read 0: budgets.json must give it an absolute noise floor (when it is compared). */
  readonly zeroable?: boolean;
}

export type MetricValues = Record<string, number>;

export interface RunContext {
  readonly subject: StoreSubject;
  /** Gate parameters from budgets.json, with $refs into `scale` resolved. */
  readonly params: Readonly<Record<string, unknown>>;
  /** budgets.json `scale` (BRIEF 6.2). */
  readonly scale: Readonly<Record<string, unknown>>;
  readonly variant: Variant;
  /** 1-based index of this run among the scenario's runs. */
  readonly runIndex: number;
  /** CPU throttling rate for this gate, from budgets.json. */
  readonly cpuThrottlingRate: number;
  /** Directory of the reference app built against the subject (browser scenarios). */
  readonly appDir: string | undefined;
  /** S5: nightly compressed mode (BRIEF 6.3: may compress time but must apply at least 2M writes); false = the full session length. */
  readonly s5Compressed: boolean;
  /** Records a non-numeric fact about the run (browser version, measurement source). */
  note(key: string, value: string | number): void;
  /** Runs `exportName(args)` from `moduleUrl` in a fresh `node --expose-gc` process, with extra Node flags if given. */
  isolate<T>(moduleUrl: string, exportName: string, args: unknown, nodeFlags?: readonly string[]): Promise<T>;
  log(message: string): void;
}

export interface ScenarioDefinition {
  /** Gate id from budgets.json (S4a, S6b, ...). */
  readonly id: string;
  readonly title: string;
  readonly environment: 'node' | 'browser';
  readonly requires: readonly Capability[];
  readonly metrics: Readonly<Record<string, MetricSpec>>;
  /** Runs once, inside a fresh child process. */
  run(context: RunContext): Promise<MetricValues>;
}

/** A gate measured by running other scenarios under a variant and comparing with a bare tree (S6(b)). */
export interface CompositeDefinition {
  readonly id: string;
  readonly title: string;
  readonly requires: readonly Capability[];
  readonly compare: { readonly scenarios: readonly string[]; readonly variant: Variant; readonly against: Variant };
}

/** A gate whose check lives outside this harness (S6(a), S6(c), Q1). */
export interface ExternalDefinition {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
}

export type AnyDefinition =
  | ({ readonly kind: 'scenario' } & ScenarioDefinition)
  | ({ readonly kind: 'composite' } & CompositeDefinition)
  | ({ readonly kind: 'external' } & ExternalDefinition);
