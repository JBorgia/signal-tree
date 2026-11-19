/** Exact source operations in the complete physical dependency order. */
export type EntityStructureOperation =
  | { kind: 'remove'; subject: number; key: string | number }
  | { kind: 'restore' | 'fresh'; subject: number; key: string | number; value: unknown; beforeSubject?: number; afterSubject?: number }
  | { kind: 'rekey'; subject: number; from: string | number; key: string | number; value: unknown; placement?: {beforeSubject?:number;afterSubject?:number} };
export interface PreparedEntityStructure {
  install(): void;
  complete(): void;
  invalidate(): void;
}
