import type { WriteMetadata } from '../mutation-types';
import { combineTerminalRecords, type PreparedPublicationUnit } from './intrinsic-mutation';
import type { StructuralEffect } from './source-mutation';

/** Source facts prepared with installation, never reconstructed from delivery. */
export interface EntityPublicationEdit {
  readonly subject: number;
  readonly before: unknown;
  readonly after: unknown;
  readonly fields: readonly string[] | null;
  readonly structural?: StructuralEffect;
}
export interface EntityPublicationPacket {
  readonly owner: number;
  readonly meta: WriteMetadata | undefined;
  readonly physical: readonly EntityPublicationEdit[];
  readonly ordinary: readonly EntityPublicationEdit[];
  readonly physicalOrder?: readonly number[];
  readonly ordinaryOrder?: readonly number[];
}
export interface EntityPublicationParticipant {
  prepare(packet: EntityPublicationPacket, native?: object): PreparedPublicationUnit | undefined;
  complete(completion: object): void;
  captureInput?(subject?: number, field?: string): object | undefined;
}
let factory: ((source: EntityPublicationSource) => EntityPublicationParticipant) | undefined;
export function registerEntityPublicationFactory(value: NonNullable<typeof factory>): void {
  if (factory) throw new Error('Entity publication authority already registered');
  factory = value;
}
/** Native ownership lives with the collection even when there are no recipients. */
export class EntityPublicationSource {
  private native: EntityPublicationParticipant | undefined;
  private readonly recipients = new Set<EntityPublicationParticipant>();
  private nativeParticipant(): EntityPublicationParticipant | undefined {
    return this.native ??= factory?.(this);
  }
  subscribe(participant: EntityPublicationParticipant): () => void {
    this.nativeParticipant();
    this.recipients.add(participant);
    return () => { this.recipients.delete(participant); };
  }
  captureInput(subject?: number, field?: string): object | undefined {
    return this.nativeParticipant()?.captureInput?.(subject, field);
  }
  prepare(packet: EntityPublicationPacket): PreparedPublicationUnit | undefined {
    const parts: { participant: EntityPublicationParticipant; unit: PreparedPublicationUnit }[] = [];
    const native = this.nativeParticipant();
    const nativeUnit = native?.prepare(packet);
    if (native && nativeUnit) parts.push({ participant: native, unit: nativeUnit });
    for (const participant of this.recipients) {
      const unit = participant.prepare(packet, nativeUnit?.completion);
      if (unit) parts.push({ participant, unit });
    }
    if (!parts.length) return undefined;
    return {
      record: combineTerminalRecords(...parts.map(part => part.unit.record))!,
      completion: { parts },
      finalize: () => { for (const part of parts) part.unit.finalize?.(); },
    };
  }
  complete(completion: object): void {
    const { parts } = completion as { parts: readonly {participant: EntityPublicationParticipant; unit: PreparedPublicationUnit}[] };
    let failed = false;
    let first: unknown;
    for (const part of parts) {
      try { part.participant.complete(part.unit.completion); }
      catch (error) { if (!failed) { failed = true; first = error; } }
    }
    if (failed) throw first;
  }
}
const ENTITY_PUBLICATION = Symbol('signaltree.entityPublication');
export interface EntityPublicationBinding {
  readonly source: EntityPublicationSource;
  readonly subject?: number;
  readonly field?: string;
}
export function defineEntityPublicationBinding(node: object, binding: EntityPublicationBinding): void {
  Object.defineProperty(node, ENTITY_PUBLICATION, { value: binding });
}
export function getEntityPublicationBinding(node: unknown): EntityPublicationBinding | undefined {
  return node !== null && (typeof node === 'object' || typeof node === 'function')
    ? (node as Record<symbol, EntityPublicationBinding | undefined>)[ENTITY_PUBLICATION]
    : undefined;
}
