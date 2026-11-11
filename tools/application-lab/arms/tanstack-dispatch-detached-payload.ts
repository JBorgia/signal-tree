import { DestroyRef, computed, inject, signal } from '@angular/core';
import {
  createCollection,
  injectLiveQuery,
  localOnlyCollectionOptions,
} from '@tanstack/angular-db';

import {
  initialCapacity,
  unresolved,
  validateAssignment,
  type AssignmentField,
  type Capacity,
  type Command,
  type Decision,
  type Dispatch,
  type DispatchJob,
  type DispatchTransport,
  type Operation,
  type Preview,
  type Publication,
  type PublicationPayload,
} from '../dispatch-model';

interface JobEntry {
  id: string;
  position: number;
  value: DispatchJob;
}
type StoredPayload =
  | {
      kind: 'plan';
      rows: DispatchJob[];
      capacity: Capacity;
    }
  | Extract<PublicationPayload, { kind: 'progress' }>;
interface StoredPublication extends Omit<Publication, 'inputs' | 'payload'> {
  inputs: string[];
}
interface PublicationEntry {
  id: string;
  order: number;
  value: StoredPublication;
}

/**
 * Accepted records and independently keyed commands are distinct collections.
 * This application projection does not ask overlapping whole-row optimistic
 * transactions to implement independent field rejection or revision arbitration.
 */
export function createDispatch(
  rows: readonly DispatchJob[],
  transport: DispatchTransport
): Dispatch {
  const live = signal(true);
  const previewOpened = signal(false);
  const rowChanges = signal(0);
  const operationChanges = signal(0);
  const capacityChanges = signal(0);
  const initialPanel = initialCapacity();
  let nextPosition = rows.length;
  let nextOperation = 0;
  let nextPublication = 0;
  let draining = false;
  let drainAgain = false;
  let cleanup: Promise<void> | undefined;

  const jobs = createCollection(
    localOnlyCollectionOptions<JobEntry, string>({
      getKey: (entry) => entry.id,
      initialData: rows.map((value, position) => ({
        id: value.id,
        position,
        value: { ...value },
      })),
    })
  );
  const commands = createCollection(
    localOnlyCollectionOptions<Operation, string>({
      getKey: (operation) => operation.id,
    })
  );
  const panels = createCollection(
    localOnlyCollectionOptions<Capacity, string>({
      getKey: (panel) => panel.instance,
      initialData: [{ ...initialPanel }],
    })
  );
  const intents = createCollection(
    localOnlyCollectionOptions<PublicationEntry, string>({
      getKey: (entry) => entry.id,
    })
  );

  // This is a pending-command lookup, not a second copy of accepted state.
  // It avoids scanning every operation for each point presentation read.
  const pendingBySubject = new Map<string, Set<string>>();
  const usedCommandIds = new Set<string>();
  const usedIntentIds = new Set<string>();
  // Private application variant: immutable publication data has a different
  // lifetime from mutable acknowledgement metadata. Keeping it out of collection
  // draft updates avoids copying the full payload on each state transition.
  // This storage and its cleanup remain part of the measured application cost.
  const publicationPayloads = new Map<string, StoredPayload>();
  const subscriptions = [
    jobs.subscribeChanges(() => rowChanges.update((value) => value + 1)),
    commands.subscribeChanges(() =>
      operationChanges.update((value) => value + 1)
    ),
    panels.subscribeChanges(() => capacityChanges.update((value) => value + 1)),
  ];

  const operationQuery = injectLiveQuery((q) =>
    live()
      ? q
          .from({ operation: commands })
          .orderBy(({ operation }) => operation.order, 'asc')
      : undefined
  );
  const publicationQuery = injectLiveQuery((q) =>
    live()
      ? q
          .from({ entry: intents })
          .orderBy(({ entry }) => entry.order, 'asc')
          .select(({ entry }) => ({ value: entry.value }))
      : undefined
  );
  const previewRows = injectLiveQuery((q) =>
    live() && previewOpened()
      ? q
          .from({ entry: jobs })
          .orderBy(({ entry }) => entry.position, 'asc')
          .select(({ entry }) => ({ value: entry.value }))
      : undefined
  );
  const publicationView = computed<readonly Publication[]>(() =>
    live()
      ? publicationQuery.data().map(({ value }) => {
          const payload = publicationPayloads.get(value.id);
          return payload ? { ...value, payload } : value;
        })
      : []
  );
  // Collection rows include enumerable virtual metadata. The application API
  // exposes its domain fields, not collection status/identity as wire data.
  const operationView = computed<readonly Operation[]>(() =>
    live()
      ? operationQuery.data().map((operation) => ({
          ...commandEnvelope(operation),
          order: operation.order,
          outcome: operation.outcome,
        }))
      : []
  );

  function pendingFor(subject: string): Operation[] {
    const result: Operation[] = [];
    for (const id of pendingBySubject.get(subject) ?? []) {
      const operation = commands.get(id);
      if (operation && unresolved(operation)) result.push(operation);
    }
    return result;
  }

  function projectedRow(accepted: DispatchJob): DispatchJob {
    let owner: Operation | undefined;
    let status: Operation | undefined;
    for (const operation of pendingFor(accepted.id)) {
      if (operation.instance !== accepted.instance) continue;
      if (
        operation.field === 'owner' &&
        operation.expectedRevision >= accepted.ownerRevision &&
        (!owner || operation.order > owner.order)
      )
        owner = operation;
      if (
        operation.field === 'status' &&
        operation.expectedRevision >= accepted.statusRevision &&
        (!status || operation.order > status.order)
      )
        status = operation;
    }
    if (!owner && !status) return accepted;
    return {
      ...accepted,
      ...(owner ? { owner: owner.value as string } : {}),
      ...(status ? { status: status.value as DispatchJob['status'] } : {}),
    };
  }

  function projectedCapacity(): Capacity {
    capacityChanges();
    operationChanges();
    if (!live()) return { ...initialPanel };
    const accepted = panels.get(initialPanel.instance);
    if (!accepted) throw new Error('Missing accepted capacity');
    let latest: Operation | undefined;
    for (const operation of pendingFor('capacity')) {
      if (
        operation.field === 'capacity' &&
        operation.instance === accepted.instance &&
        operation.expectedRevision >= accepted.revision &&
        (!latest || operation.order > latest.order)
      )
        latest = operation;
    }
    return {
      instance: accepted.instance,
      value: latest ? (latest.value as number) : accepted.value,
      revision: accepted.revision,
    };
  }

  const preview = computed<Preview | null>(() => {
    if (!live() || !previewOpened()) return null;
    operationChanges();
    const currentRows = previewRows
      .data()
      .map((entry) => projectedRow(entry.value));
    let pending = 0;
    for (const ids of pendingBySubject.values()) pending += ids.size;
    return { rows: currentRows, capacity: projectedCapacity(), pending };
  });

  function commandEnvelope(operation: Command): Command {
    return {
      id: operation.id,
      subject: operation.subject,
      instance: operation.instance,
      field: operation.field,
      value: operation.value,
      expectedRevision: operation.expectedRevision,
    };
  }

  function markUnknown(id: string): void {
    if (!live()) return;
    const operation = commands.get(id);
    if (operation && unresolved(operation) && operation.outcome !== 'unknown') {
      commands.update(id, (draft) => {
        draft.outcome = 'unknown';
      });
    }
  }

  function removePending(operation: Operation): void {
    const ids = pendingBySubject.get(operation.subject);
    ids?.delete(operation.id);
    if (ids?.size === 0) pendingBySubject.delete(operation.subject);
  }

  function applyAuthority(operation: Operation, decision: Decision): void {
    // A conflict after replacement can name the server's new instance. It is a
    // known outcome for the old command, but cannot update the new local entity.
    if (decision.instance !== operation.instance) return;
    if (operation.field === 'capacity') {
      const current = panels.get(operation.instance);
      if (!current || decision.revision < current.revision) return;
      if (
        typeof decision.value !== 'number' ||
        !Number.isFinite(decision.value)
      ) {
        throw new Error('Invalid capacity decision');
      }
      panels.update(current.instance, (draft) => {
        draft.value = decision.value as number;
        draft.revision = decision.revision;
      });
      return;
    }
    const current = jobs.get(operation.subject);
    if (!current || current.value.instance !== operation.instance) return;
    const revision =
      operation.field === 'owner'
        ? current.value.ownerRevision
        : current.value.statusRevision;
    if (decision.revision < revision) return;
    if (typeof decision.value !== 'string')
      throw new Error('Invalid assignment decision');
    const value = validateAssignment(operation.field, decision.value);
    jobs.update(operation.subject, (draft) => {
      if (operation.field === 'owner') {
        draft.value.owner = value;
        draft.value.ownerRevision = decision.revision;
      } else {
        draft.value.status = value as DispatchJob['status'];
        draft.value.statusRevision = decision.revision;
      }
    });
  }

  function settle(id: string, decision: Decision): void {
    if (!live()) return;
    const operation = commands.get(id);
    if (!operation || !unresolved(operation)) return;
    if (decision.commandId !== id || decision.field !== operation.field) {
      markUnknown(id);
      return;
    }
    applyAuthority(operation, decision);
    removePending(operation);
    commands.update(id, (draft) => {
      draft.outcome = decision.outcome;
    });
    drainPublications();
  }

  function send(operation: Operation): void {
    // Retry deliberately uses the original command, including its original
    // expected revision. A fresh ID or revised payload is a different command.
    let response: Promise<Decision>;
    try {
      response = transport.send(commandEnvelope(operation));
    } catch {
      markUnknown(operation.id);
      return;
    }
    void response.then(
      (decision) => settle(operation.id, decision),
      () => markUnknown(operation.id)
    );
  }

  function submit(command: Command): void {
    if (usedCommandIds.has(command.id))
      throw new Error('Command ID already used; retry the existing command');
    usedCommandIds.add(command.id);
    const operation: Operation = {
      ...command,
      order: nextOperation++,
      outcome: 'pending',
    };
    let ids = pendingBySubject.get(command.subject);
    if (!ids) {
      ids = new Set();
      pendingBySubject.set(command.subject, ids);
    }
    ids.add(command.id);
    commands.insert(operation);
    send(operation);
  }

  function assign(
    id: string,
    field: AssignmentField,
    value: string,
    commandId: string
  ): void {
    if (!live()) return;
    const accepted = jobs.get(id)?.value;
    if (!accepted) return;
    submit({
      id: commandId,
      subject: id,
      instance: accepted.instance,
      field,
      value: validateAssignment(field, value),
      expectedRevision:
        field === 'owner' ? accepted.ownerRevision : accepted.statusRevision,
    });
  }

  function relevant(
    operation: Operation,
    kind: PublicationPayload['kind'],
    subject?: string
  ): boolean {
    if (!unresolved(operation)) return false;
    if (operation.field === 'capacity') {
      return (
        kind === 'plan' &&
        panels.get(initialPanel.instance)?.instance === operation.instance
      );
    }
    if (jobs.get(operation.subject)?.value.instance !== operation.instance)
      return false;
    return (
      kind === 'plan' ||
      (operation.subject === subject && operation.field === 'status')
    );
  }

  function freezePayload(intent: StoredPublication): StoredPayload {
    let payload: StoredPayload;
    if (intent.kind === 'progress') {
      const row =
        intent.subject === undefined
          ? undefined
          : jobs.get(intent.subject)?.value;
      if (!row) throw new Error('Missing progress subject');
      payload = {
        kind: 'progress',
        subject: row.id,
        instance: row.instance,
        status: row.status,
        statusRevision: row.statusRevision,
      };
    } else {
      const capacity = panels.get(initialPanel.instance);
      if (!capacity) throw new Error('Missing accepted capacity');
      const acceptedRows = Array.from(jobs.values())
        .sort((a, b) => a.position - b.position)
        .map((entry) => Object.freeze({ ...entry.value }));
      payload = {
        kind: 'plan',
        rows: acceptedRows,
        capacity: {
          instance: capacity.instance,
          value: capacity.value,
          revision: capacity.revision,
        },
      };
      Object.freeze(payload.rows);
      Object.freeze(payload.capacity);
    }
    Object.freeze(payload);
    return payload;
  }

  function drainPublications(): void {
    if (!live()) return;
    if (draining) {
      drainAgain = true;
      return;
    }
    draining = true;
    try {
      do {
        drainAgain = false;
        const waiting = Array.from(intents.values()).filter(
          (entry) => entry.value.state === 'waiting'
        );
        for (const entry of waiting) {
          if (!live()) break;
          const current = intents.get(entry.id)?.value;
          if (!current || current.state !== 'waiting') continue;
          let ready = true;
          for (const id of current.inputs) {
            const operation = commands.get(id);
            if (!operation)
              throw new Error(
                'Publication input was discarded before settlement'
              );
            if (unresolved(operation)) {
              ready = false;
              break;
            }
          }
          if (!ready) continue;
          const payload = freezePayload(current);
          // Publish can synchronously reenter app code. Mark this record before
          // entering transport and iterate the stable waiting snapshot above.
          // Install the frozen payload before publishing the reactive state, so
          // observers of 'started' can already read the complete publication.
          publicationPayloads.set(entry.id, payload);
          intents.update(entry.id, (draft) => {
            draft.value.state = 'started';
          });
          const acknowledgement = transport.publish(entry.id, payload);
          void acknowledgement.then(() => {
            if (!live() || intents.get(entry.id)?.value.state !== 'started')
              return;
            intents.update(entry.id, (draft) => {
              draft.value.state = 'acknowledged';
            });
          });
        }
      } while (live() && drainAgain);
    } finally {
      draining = false;
    }
  }

  function publish(
    id: string,
    kind: PublicationPayload['kind'],
    subject?: string
  ): void {
    if (!live()) return;
    if (usedIntentIds.has(id))
      throw new Error('Publication intent ID already used');
    if (kind === 'progress' && (subject === undefined || !jobs.has(subject))) {
      throw new Error('Missing progress subject');
    }
    usedIntentIds.add(id);
    const inputs = Array.from(commands.values())
      .filter((operation) => relevant(operation, kind, subject))
      .sort((a, b) => a.order - b.order)
      .map((operation) => operation.id);
    const value: StoredPublication = {
      id,
      kind,
      state: 'waiting',
      inputs,
      ...(kind === 'progress' ? { subject } : {}),
    };
    intents.insert({ id, order: nextPublication++, value });
    drainPublications();
  }

  function destroy(): Promise<void> {
    if (cleanup) return cleanup;
    // Capture current query resources before disabling their computed configs.
    const queryCollections = [
      operationQuery.collection(),
      publicationQuery.collection(),
      previewRows.collection(),
    ];
    live.set(false);
    for (const subscription of subscriptions) subscription.unsubscribe();
    pendingBySubject.clear();
    usedCommandIds.clear();
    usedIntentIds.clear();
    publicationPayloads.clear();
    // The host destroys the session injector first, detaching Angular query
    // observers synchronously. Native query cleanup must finish before source
    // cleanup; starting both together can retire a still-observed source.
    cleanup = Promise.all(
      queryCollections.map((collection) => collection?.cleanup())
    ).then(async () => {
      await Promise.all([
        jobs.cleanup(),
        commands.cleanup(),
        panels.cleanup(),
        intents.cleanup(),
      ]);
    });
    return cleanup;
  }
  inject(DestroyRef).onDestroy(() => {
    void destroy();
  });

  return {
    kind: 'tanstack',
    row(id) {
      rowChanges();
      operationChanges();
      const accepted = live() ? jobs.get(id)?.value : undefined;
      return accepted && projectedRow(accepted);
    },
    canonical(id) {
      rowChanges();
      return live() ? jobs.get(id)?.value : undefined;
    },
    capacity: projectedCapacity,
    operations: operationView,
    publications: publicationView,
    preview,
    openPreview() {
      if (live()) previewOpened.set(true);
    },
    assign,
    draftCapacity(value, commandId) {
      if (!live()) return;
      if (!Number.isFinite(value) || value < 0)
        throw new Error('Invalid capacity');
      const capacity = panels.get(initialPanel.instance);
      if (!capacity) throw new Error('Missing accepted capacity');
      submit({
        id: commandId,
        subject: 'capacity',
        instance: capacity.instance,
        field: 'capacity',
        value,
        expectedRevision: capacity.revision,
      });
    },
    timeout: markUnknown,
    retry(id) {
      if (!live()) return;
      const operation = commands.get(id);
      if (operation && unresolved(operation)) send(operation);
    },
    publish,
    replace(id, replacement) {
      if (!live()) return;
      if (replacement.id !== id)
        throw new Error('Replacement must reuse the requested ID');
      if (jobs.has(id)) jobs.delete(id);
      jobs.insert({ id, position: nextPosition++, value: { ...replacement } });
    },
    openEditor(id) {
      const instance = live() ? jobs.get(id)?.value.instance : undefined;
      return {
        assign(field, value, commandId) {
          if (
            live() &&
            instance !== undefined &&
            jobs.get(id)?.value.instance === instance
          ) {
            assign(id, field, value, commandId);
          }
        },
      };
    },
    dismissSettled() {
      if (!live()) return;
      const protectedIds = new Set<string>();
      for (const entry of intents.values()) {
        if (entry.value.state === 'waiting')
          for (const id of entry.value.inputs) protectedIds.add(id);
      }
      const dismissed = Array.from(commands.values())
        .filter(
          (operation) =>
            !unresolved(operation) && !protectedIds.has(operation.id)
        )
        .map((operation) => operation.id);
      if (dismissed.length) commands.delete(dismissed);
      const acknowledged = Array.from(intents.values())
        .filter((entry) => entry.value.state === 'acknowledged')
        .map((entry) => entry.id);
      if (acknowledged.length) {
        for (const id of acknowledged) publicationPayloads.delete(id);
        intents.delete(acknowledged);
      }
    },
    destroy,
  };
}
