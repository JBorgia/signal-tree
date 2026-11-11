import type { Job } from './model';

// Application protocol only. No shared optimistic-state or publication engine.
export type AssignmentField = 'owner' | 'status';
export interface DispatchJob extends Job {
  statusRevision: number;
}
export interface Capacity {
  instance: string;
  value: number;
  revision: number;
}
export interface Command {
  id: string;
  subject: string;
  instance: string;
  field: AssignmentField | 'capacity';
  value: string | number;
  expectedRevision: number;
}
export interface Decision {
  commandId: string;
  instance: string;
  field: Command['field'];
  outcome: 'applied' | 'rejected' | 'conflict';
  value: string | number;
  revision: number;
}
export interface Operation extends Command {
  order: number;
  outcome: 'pending' | 'unknown' | Decision['outcome'];
}
export type PublicationPayload =
  | {
      kind: 'plan';
      rows: readonly DispatchJob[];
      capacity: Capacity;
    }
  | {
      kind: 'progress';
      subject: string;
      instance: string;
      status: DispatchJob['status'];
      statusRevision: number;
    };
export interface Publication {
  id: string;
  kind: PublicationPayload['kind'];
  subject?: string;
  state: 'waiting' | 'started' | 'acknowledged';
  inputs: readonly string[];
  payload?: PublicationPayload;
}
export interface Preview {
  rows: readonly DispatchJob[];
  capacity: Capacity;
  pending: number;
}
export interface DispatchTransport {
  send(command: Command): Promise<Decision>;
  publish(id: string, payload: PublicationPayload): Promise<void>;
}
export interface DispatchEditor {
  assign(field: AssignmentField, value: string, commandId: string): void;
}
export interface Dispatch {
  readonly kind: string;
  row(id: string): DispatchJob | undefined;
  canonical(id: string): DispatchJob | undefined;
  capacity(): Capacity;
  operations(): readonly Operation[];
  publications(): readonly Publication[];
  preview(): Preview | null;
  openPreview(): void;
  assign(
    id: string,
    field: AssignmentField,
    value: string,
    commandId: string
  ): void;
  draftCapacity(value: number, commandId: string): void;
  timeout(commandId: string): void;
  retry(commandId: string): void;
  publish(
    intentId: string,
    kind: PublicationPayload['kind'],
    subject?: string
  ): void;
  replace(id: string, row: DispatchJob): void;
  openEditor(id: string): DispatchEditor;
  // Explicit user dismissal of known outcomes; unresolved operations and inputs
  // captured by waiting publications must survive. Used in finite aging runs.
  dismissSettled(): void;
  destroy(): void | Promise<void>;
}
export type DispatchFactory = (
  rows: readonly DispatchJob[],
  transport: DispatchTransport
) => Dispatch;
export const initialCapacity = (): Capacity => ({
  instance: 'capacity-1',
  value: 4,
  revision: 10,
});
export const dispatchRows = (rows: readonly Job[]): DispatchJob[] =>
  rows.map((row) => ({ ...row, statusRevision: 10 }));
export const unresolved = (operation: Operation): boolean =>
  operation.outcome === 'pending' || operation.outcome === 'unknown';
export function validateAssignment(
  field: AssignmentField,
  value: string
): string {
  const trimmed = value.trim();
  if (
    !trimmed ||
    (field === 'status' && !['queued', 'active', 'done'].includes(trimmed))
  ) {
    throw new Error('Invalid assignment');
  }
  return trimmed;
}
