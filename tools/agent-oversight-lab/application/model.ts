export type Values = {
  route: string;
  note: string;
  window: string;
  capacity: number;
};
export type Observation = {
  entityId: 'delivery-1';
  instance: string;
  values: Values;
  versions: Record<keyof Values, number>;
};
export type Session = {
  sessionId: string;
  epoch: number;
  principal: string;
  tenant: string;
  role: 'proposer' | 'reviewer';
  destinations: string[];
  stopped: boolean;
};
export type Command = {
  commandId: string;
  operationId: string;
  sessionId: string;
  sessionEpoch: number;
  actor: { kind: 'unknown' } | { kind: 'declared'; label: string };
  proposal: {
    entityId: 'delivery-1';
    expectedInstance: string;
    patch: Partial<Values>;
    expected: Partial<Record<keyof Values, number>>;
  };
};
export type Review = {
  requestId: string;
  principal: string;
  sessionId: string;
  sessionEpoch: number;
  command: Command;
  digest: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'applied';
  reviewer: string | null;
  decisionAt: string | null;
};
export type Receipt = {
  commandId: string;
  operationId: string;
  sessionId: string;
  sessionEpoch: number;
  principal: string;
  tenant: string;
  destination: string;
  requestId: string;
  commandDigest: string;
  status: 'applied' | 'rejected';
  reason?: string;
  effectSequence: number;
  instance: string;
  timestamp: string;
};
export type AuditEvent = {
  sequence: number;
  tenant: string;
  destination: string;
  kind: string;
  timestamp: string;
  principal?: string;
  reviewer?: string;
  sessionId?: string;
  epoch?: number;
  operationId?: string;
  commandId?: string;
  requestId?: string;
  status?: string;
  reason?: string;
  instance?: string;
  digest?: string;
};
export type AuditPage = {
  events: AuditEvent[];
  retention: {
    firstAvailableSequence: number;
    latestSequence: number;
    truncated: boolean;
  };
  nextCursor: number;
  hasMore: boolean;
};

export class RequestFailure extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`HTTP ${status}: ${code}`);
  }
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const token = sessionStorage.getItem('dispatch-session-token');
  if (!token) throw new RequestFailure(401, 'sign-in-required');
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const code =
      value &&
      typeof value === 'object' &&
      'error' in value &&
      typeof value.error === 'string' &&
      /^[a-z-]{1,64}$/.test(value.error)
        ? value.error
        : 'request-failed';
    throw new RequestFailure(response.status, code);
  }
  return value as T;
}
