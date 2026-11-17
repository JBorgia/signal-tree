import type { Command } from '../coordinator.mjs';
export type Values = {
  route: string;
  note: string;
  window: string;
  capacity: number;
};
export type Observation = {
  instance: string;
  values: Values;
  versions: Record<keyof Values, number>;
};
export type Proposal = {
  entityId: 'delivery-1';
  expectedInstance: string;
  patch: { route: string };
  expected: { route: number; capacity: number };
};
export type WireCommand = Command<Proposal>;
export type Fault = 'none' | 'skip-native-settlement' | 'ignore-instance';
export type Initial = { observation: Observation; fault: Fault };
export function makeProposal(
  observation: Observation,
  patch: unknown,
  reads?: readonly string[]
): Proposal {
  if (
    !patch ||
    typeof patch !== 'object' ||
    Array.isArray(patch) ||
    !('route' in patch) ||
    typeof patch.route !== 'string' ||
    !patch.route.trim() ||
    Object.keys(patch).some((key) => key !== 'route') ||
    reads?.some((key) => key !== 'capacity')
  ) {
    throw new Error('Unsupported dispatch proposal');
  }
  return {
    entityId: 'delivery-1',
    expectedInstance: observation.instance,
    patch: { route: patch.route },
    expected: {
      route: observation.versions.route,
      capacity: observation.versions.capacity,
    },
  };
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer fixture-only',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}
