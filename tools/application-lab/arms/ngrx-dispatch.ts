import { computed, type Signal } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  addEntity,
  removeAllEntities,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';

import {
  initialCapacity,
  unresolved,
  validateAssignment,
  type AssignmentField,
  type Capacity,
  type Command,
  type Decision,
  type Dispatch,
  type DispatchEditor,
  type DispatchJob,
  type DispatchTransport,
  type Operation,
  type Preview,
  type Publication,
  type PublicationPayload,
} from '../dispatch-model';

interface CoordinationState {
  capacityState: Capacity;
  operationList: Operation[];
  publicationList: Publication[];
  previewOpen: boolean;
}

const DispatchStore = signalStore(
  withEntities<DispatchJob>(),
  withState<CoordinationState>(() => ({
    capacityState: initialCapacity(),
    operationList: [],
    publicationList: [],
    previewOpen: false,
  })),
  withMethods((store) => {
    let live = true;
    let channel: DispatchTransport | undefined;
    let nextOrder = 0;
    let publishing = false;
    // Keep small ID reservations after payload dismissal. This measured
    // action-count growth is separate from retained operation/payload history.
    const seenCommands = new Set<string>();
    const seenIntents = new Set<string>();
    const editors = new Map<string, object>();
    const progressInstances = new Map<string, string>();
    const views = new Map<string, Signal<DispatchJob | undefined>>();

    function row(id: string): DispatchJob | undefined {
      if (!live) return undefined;
      let view = views.get(id);
      if (!view) {
        view = computed(() => {
          const accepted = store.entityMap()[id];
          if (!accepted) return undefined;
          let projected = accepted;
          for (const operation of store.operationList()) {
            if (
              !unresolved(operation) ||
              operation.subject !== id ||
              operation.instance !== accepted.instance
            )
              continue;
            const revision =
              operation.field === 'owner'
                ? accepted.ownerRevision
                : accepted.statusRevision;
            if (operation.expectedRevision < revision) continue;
            if (
              operation.field === 'owner' &&
              typeof operation.value === 'string'
            ) {
              projected = { ...projected, owner: operation.value };
            } else if (operation.field === 'status') {
              const status = operation.value;
              if (
                status === 'queued' ||
                status === 'active' ||
                status === 'done'
              ) {
                projected = { ...projected, status };
              }
            }
          }
          return projected;
        });
        views.set(id, view);
      }
      return view();
    }

    const capacity = computed(() => {
      const accepted = store.capacityState();
      let projected = accepted;
      for (const operation of store.operationList()) {
        if (
          operation.field === 'capacity' &&
          operation.instance === accepted.instance &&
          unresolved(operation) &&
          operation.expectedRevision >= accepted.revision &&
          typeof operation.value === 'number'
        ) {
          projected = { ...accepted, value: operation.value };
        }
      }
      return projected;
    });

    function current(operation: Operation): boolean {
      return operation.field === 'capacity'
        ? store.capacityState().instance === operation.instance
        : store.entityMap()[operation.subject]?.instance === operation.instance;
    }

    function unknown(commandId: string): void {
      if (!live) return;
      const operation = store
        .operationList()
        .find((value) => value.id === commandId);
      if (!operation || !current(operation) || operation.outcome !== 'pending')
        return;
      patchState(store, {
        operationList: store
          .operationList()
          .map((value) =>
            value.id === commandId ? { ...value, outcome: 'unknown' } : value
          ),
      });
    }

    function receive(decision: Decision): void {
      if (!live) return;
      const operation = store
        .operationList()
        .find((value) => value.id === decision.commandId);
      if (!operation || !current(operation) || !unresolved(operation)) return;
      if (
        decision.instance !== operation.instance ||
        decision.field !== operation.field
      ) {
        throw new Error('Decision does not match its command');
      }
      if (!Number.isSafeInteger(decision.revision) || decision.revision < 0) {
        throw new Error('Invalid authoritative revision');
      }
      const operationList = store
        .operationList()
        .map((value) =>
          value.id === operation.id
            ? { ...value, outcome: decision.outcome }
            : value
        );
      if (operation.field === 'capacity') {
        if (
          typeof decision.value !== 'number' ||
          !Number.isFinite(decision.value) ||
          decision.value < 0
        )
          throw new Error('Invalid authoritative capacity');
        const accepted = store.capacityState();
        patchState(store, {
          operationList,
          ...(decision.revision >= accepted.revision
            ? {
                capacityState: {
                  ...accepted,
                  value: decision.value,
                  revision: decision.revision,
                },
              }
            : {}),
        });
      } else {
        const accepted = store.entityMap()[operation.subject];
        if (typeof decision.value !== 'string')
          throw new Error('Invalid authoritative assignment');
        const value = validateAssignment(operation.field, decision.value);
        if (
          operation.field === 'owner' &&
          decision.revision >= accepted.ownerRevision
        ) {
          patchState(
            store,
            updateEntity<DispatchJob>({
              id: operation.subject,
              changes: { owner: value, ownerRevision: decision.revision },
            }),
            { operationList }
          );
        } else if (
          operation.field === 'status' &&
          decision.revision >= accepted.statusRevision
        ) {
          if (value !== 'queued' && value !== 'active' && value !== 'done') {
            throw new Error('Invalid authoritative status');
          }
          patchState(
            store,
            updateEntity<DispatchJob>({
              id: operation.subject,
              changes: { status: value, statusRevision: decision.revision },
            }),
            { operationList }
          );
        } else {
          // A delayed success still settles its own command; the canonical
          // field already carries a newer authoritative revision.
          patchState(store, { operationList });
        }
      }
      drain();
    }

    function send(operation: Operation): void {
      if (!live || !channel || !current(operation)) return;
      const command: Command = {
        id: operation.id,
        subject: operation.subject,
        instance: operation.instance,
        field: operation.field,
        value: operation.value,
        expectedRevision: operation.expectedRevision,
      };
      try {
        void channel.send(command).then(
          (decision) => {
            if (!live) return;
            if (decision.commandId !== operation.id)
              throw new Error('Wrong command response');
            receive(decision);
          },
          () => unknown(operation.id)
        );
      } catch (error) {
        unknown(operation.id);
        throw error;
      }
    }

    function register(command: Command): void {
      if (!command.id.trim()) throw new Error('Command ID is required');
      if (seenCommands.has(command.id))
        throw new Error('Command ID already used; use retry');
      seenCommands.add(command.id);
      const operation: Operation = {
        ...command,
        order: nextOrder++,
        outcome: 'pending',
      };
      patchState(store, {
        operationList: [...store.operationList(), operation],
      });
      send(operation);
    }

    function assign(
      id: string,
      field: AssignmentField,
      value: string,
      commandId: string
    ): void {
      if (!live) return;
      if (field !== 'owner' && field !== 'status')
        throw new Error('Invalid assignment field');
      const normalized = validateAssignment(field, value);
      const accepted = store.entityMap()[id];
      if (!accepted) return;
      register({
        id: commandId,
        subject: id,
        instance: accepted.instance,
        field,
        value: normalized,
        expectedRevision:
          field === 'owner' ? accepted.ownerRevision : accepted.statusRevision,
      });
    }

    function updatePublication(
      id: string,
      changes: Partial<Publication>
    ): void {
      patchState(store, {
        publicationList: store
          .publicationList()
          .map((publication) =>
            publication.id === id ? { ...publication, ...changes } : publication
          ),
      });
    }

    function payloadFor(
      publication: Publication
    ): PublicationPayload | undefined {
      if (publication.kind === 'plan') {
        return {
          kind: 'plan',
          rows: store.entities().map((value) => ({ ...value })),
          capacity: { ...store.capacityState() },
        };
      }
      const accepted = store.entityMap()[publication.subject ?? ''];
      if (
        !accepted ||
        accepted.instance !== progressInstances.get(publication.id)
      )
        return undefined;
      return {
        kind: 'progress',
        subject: accepted.id,
        instance: accepted.instance,
        status: accepted.status,
        statusRevision: accepted.statusRevision,
      };
    }

    function drain(): void {
      if (!live || publishing || !channel) return;
      const publication = store.publicationList().find(
        (value) =>
          value.state === 'waiting' &&
          value.inputs.every((id) => {
            const operation = store
              .operationList()
              .find((candidate) => candidate.id === id);
            return !operation || !unresolved(operation);
          })
      );
      if (!publication) return;
      const payload = payloadFor(publication);
      if (!payload) {
        patchState(store, {
          publicationList: store
            .publicationList()
            .filter((value) => value.id !== publication.id),
        });
        progressInstances.delete(publication.id);
        drain();
        return;
      }
      // Set the transport slot and state before a synchronous callback can
      // reenter the app. Waiting, started and acknowledged stay distinct.
      publishing = true;
      updatePublication(publication.id, { state: 'started', payload });
      const finished = (acknowledged: boolean) => {
        if (!live) return;
        if (acknowledged)
          updatePublication(publication.id, { state: 'acknowledged' });
        publishing = false;
        drain();
      };
      try {
        void channel.publish(publication.id, payload).then(
          () => finished(true),
          () => finished(false)
        );
      } catch {
        publishing = false;
        queueMicrotask(drain);
      }
    }

    function dispose(): void {
      if (!live) return;
      live = false;
      channel = undefined;
      editors.clear();
      views.clear();
      progressInstances.clear();
      seenCommands.clear();
      seenIntents.clear();
      patchState(store, removeAllEntities(), {
        operationList: [],
        publicationList: [],
        previewOpen: false,
        capacityState: initialCapacity(),
      });
      store.entities();
      capacity();
    }

    return {
      initialize(
        rows: readonly DispatchJob[],
        transport: DispatchTransport
      ): void {
        if (!live) return;
        channel = transport;
        patchState(store, setAllEntities(rows.map((value) => ({ ...value }))));
      },
      row,
      canonical(id: string): DispatchJob | undefined {
        return store.entityMap()[id];
      },
      capacity,
      operations: store.operationList,
      publications: store.publicationList,
      openPreview(): void {
        if (live) patchState(store, { previewOpen: true });
      },
      assign,
      draftCapacity(value: number, commandId: string): void {
        if (!live) return;
        if (!Number.isFinite(value) || value < 0)
          throw new Error('Invalid capacity');
        const accepted = store.capacityState();
        register({
          id: commandId,
          subject: 'capacity',
          instance: accepted.instance,
          field: 'capacity',
          value,
          expectedRevision: accepted.revision,
        });
      },
      timeout: unknown,
      retry(commandId: string): void {
        if (!live) return;
        const operation = store
          .operationList()
          .find((value) => value.id === commandId);
        if (!operation) throw new Error('Unknown command');
        if (unresolved(operation)) send(operation);
      },
      publish(
        intentId: string,
        kind: PublicationPayload['kind'],
        subject?: string
      ): void {
        if (!live) return;
        if (kind !== 'plan' && kind !== 'progress')
          throw new Error('Invalid publication kind');
        if (!intentId.trim()) throw new Error('Intent ID is required');
        if (seenIntents.has(intentId))
          throw new Error('Intent ID already used');
        const accepted =
          kind === 'progress' ? store.entityMap()[subject ?? ''] : undefined;
        if (kind === 'progress' && !accepted)
          throw new Error('Unknown publication subject');
        const inputs = store
          .operationList()
          .filter(
            (operation) =>
              unresolved(operation) &&
              current(operation) &&
              (kind === 'plan' ||
                (operation.subject === subject && operation.field === 'status'))
          )
          .map((operation) => operation.id);
        seenIntents.add(intentId);
        if (accepted) progressInstances.set(intentId, accepted.instance);
        patchState(store, {
          publicationList: [
            ...store.publicationList(),
            {
              id: intentId,
              kind,
              ...(subject === undefined ? {} : { subject }),
              state: 'waiting',
              inputs,
            },
          ],
        });
        drain();
      },
      replace(id: string, replacement: DispatchJob): void {
        if (!live) return;
        if (replacement.id !== id) throw new Error('Replacement ID must match');
        editors.delete(id);
        views.delete(id);
        patchState(store, removeEntity(id), addEntity({ ...replacement }), {
          operationList: store
            .operationList()
            .filter(
              (operation) =>
                operation.field === 'capacity' || operation.subject !== id
            ),
        });
        drain();
      },
      openEditor(id: string): DispatchEditor {
        let token: object | undefined;
        if (live && store.entityMap()[id]) {
          token = editors.get(id);
          if (!token) {
            token = {};
            editors.set(id, token);
          }
        }
        return {
          assign(field, value, commandId) {
            if (live && token && editors.get(id) === token)
              assign(id, field, value, commandId);
          },
        };
      },
      dismissSettled(): void {
        if (!live) return;
        const protectedIds = new Set(
          store
            .publicationList()
            .filter((publication) => publication.state === 'waiting')
            .flatMap((publication) => [...publication.inputs])
        );
        for (const publication of store.publicationList()) {
          if (publication.state === 'acknowledged')
            progressInstances.delete(publication.id);
        }
        patchState(store, {
          operationList: store
            .operationList()
            .filter(
              (operation) =>
                unresolved(operation) || protectedIds.has(operation.id)
            ),
          publicationList: store
            .publicationList()
            .filter((publication) => publication.state !== 'acknowledged'),
        });
      },
      dispose,
    };
  }),
  withComputed((store) => ({
    preview: computed<Preview | null>(() => {
      if (!store.previewOpen()) return null;
      return {
        rows: store.entities().map((value) => {
          const row = store.row(value.id);
          if (!row) throw new Error(`Missing live job ${value.id}`);
          return row;
        }),
        capacity: store.capacity(),
        pending: store.operations().filter(unresolved).length,
      };
    }),
  })),
  withHooks({
    onDestroy(store) {
      store.dispose();
      store.preview();
    },
  })
);

export function createDispatch(
  rows: readonly DispatchJob[],
  transport: DispatchTransport
): Dispatch {
  const store = new DispatchStore();
  store.initialize(rows, transport);
  return {
    kind: 'ngrx',
    row: store.row,
    canonical: store.canonical,
    capacity: store.capacity,
    operations: store.operations,
    publications: store.publications,
    preview: store.preview,
    openPreview: store.openPreview,
    assign: store.assign,
    draftCapacity: store.draftCapacity,
    timeout: store.timeout,
    retry: store.retry,
    publish: store.publish,
    replace: store.replace,
    openEditor: store.openEditor,
    dismissSettled: store.dismissSettled,
    destroy() {
      store.dispose();
      store.preview();
    },
  };
}
