import type { WriteMetadata } from '../types';
import type { IntrinsicMutation } from './intrinsic-mutation';

/** Derive admission metadata without rebinding context visible to callbacks. */
export function scalarAdmissionMetadata(
  meta: WriteMetadata | undefined,
  mutation: IntrinsicMutation<unknown>
): WriteMetadata {
  return {
    ...(meta ?? {}),
    mutationIntent: mutation.intent,
    ...(mutation.admissionParticipation === 'realized'
      ? { participation: 'realized' as const }
      : {}),
  };
}
