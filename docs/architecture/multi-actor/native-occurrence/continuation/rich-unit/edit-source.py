from pathlib import Path
r=Path(__file__).parent/'candidate/packages/kernel/src'
p=r/'lib/internals/mutation-capture-runtime.ts';s=p.read_text();s=s.replace('publishCommittedEntity?(capture: CommittedEntityCapture): void;', '''publishCommittedEntity?(capture: CommittedEntityCapture, deferObservation?: (delivery: () => void) => void): void;
  subscribeEntityWitness?(listener: (capture: CommittedEntityCapture) => void): () => void;
  subscribeStructuralWitness?(listener: (capture: CommittedEntityCapture) => void): () => void;''')
s=s.replace('  const entityListeners =', '''  const entityWitnesses = new Set<(capture: CommittedEntityCapture) => void>();
  const structuralWitnesses = new Set<(capture: CommittedEntityCapture) => void>();
  const entityListeners =''')
s=s.replace('entityListeners.size > 0','(entityListeners.size > 0 || entityWitnesses.size > 0)').replace('structuralBoundaryListeners.size > 0','(structuralBoundaryListeners.size > 0 || structuralWitnesses.size > 0)')
s=s.replace('    publishCommittedEntity(capture): void {','''    subscribeEntityWitness(listener) { entityWitnesses.add(listener); return () => { entityWitnesses.delete(listener); }; },
    subscribeStructuralWitness(listener) { structuralWitnesses.add(listener); return () => { structuralWitnesses.delete(listener); }; },
    publishCommittedEntity(capture, deferObservation): void {''')
a=s.index('      const listeners =',s.index('    publishCommittedEntity('));b=s.index('    subscribeCommittedEntity(listener)',a)
old=s[a:b];cond=old[old.index('        capture.structuralFrontier'):old.index('          ? [...entityListeners')]
s=s[:a]+'''      const structural = Boolean(
'''+cond+''');
      const invoke = (listeners: readonly ((capture: CommittedEntityCapture) => void)[]) => {
        for (const listener of listeners) try { listener(capture); }
        catch (error) { reportContainedObserverError({ error, operation: 'transaction:listener' }); }
      };
      // Internal admission stays synchronous and precedes arbitrary observation.
      invoke(structural ? [...entityWitnesses, ...structuralWitnesses] : [...entityWitnesses]);
      const listeners = structural ? [...entityListeners, ...structuralBoundaryListeners] : [...entityListeners];
      if (listeners.length) {
        const deliver = () => invoke(listeners);
        if (deferObservation) deferObservation(deliver); else deliver();
      }
    },
'''+s[b:];p.write_text(s)
for f in ['enhancers/transactions/transactions.ts','enhancers/restoration/restoration.ts']:
 p=r/f;s=p.read_text().replace('?.subscribeCommittedEntity?.(', '?.subscribeEntityWitness?.(').replace('?.subscribeStructuralBoundary?.(', '?.subscribeStructuralWitness?.(');p.write_text(s)
p=r/'lib/entity-signal.ts';s=p.read_text();s=s.replace('''  function commitAndProjectEntityMutationFrame(
''','''  function commitAndProjectEntityMutationFrame(
    frame: EntityMutationFrame<K, E>,
    options?: { advancePhysicalRevision?: boolean; publication?: 'physical' }
  ) {
    const prepared = prepareEntityMutationFrame(frame, options);
    const result = prepared.install();
    prepared.complete();
    return result;
  }

  function prepareEntityMutationFrame(
''',1)
a=s.index('    let installed = false;',s.index('  function prepareEntityMutationFrame('));b=s.index('\n  function withSuppliedEntityRow',a)
old=s[a:b]
# preserve original lifecycle while exposing explicit phase ownership
s=s[:a]+'''    let installed = false;
    let consumed = false;
    let completed = false;
    const observations: Array<() => void> = [];
    const resultOf = (result: ReturnType<typeof frame.commit>) => ({
      ...result, valueResults, valueResultsByStep,
      ordinaryChanges: ordinaryPlan.byPhysicalSubject,
      ordinaryEndpoints: ordinaryPlan.ordinaryEndpoints,
      topologyUnit, orderEndpoints: frame.orderEndpoints,
    });
    return {
      install() {
        if (consumed || physicalCommitClock?.revision() !== revision)
          throw new Error('Prepared entity source is stale or consumed');
        consumed = true;
        const result = frame.commit(
          observe ? () => observe(ordinaryPlan.changes, delivery => observations.push(delivery)) : undefined,
          responsibility, structuralFrontier, valueTransitions,
          () => { ordinaryPlan.install(); if (publication.unit) installTerminalRecord(publication.unit.record); installed = true; }
        );
        if (options?.advancePhysicalRevision !== false) physicalCommitClock?.advance();
        return resultOf(result);
      },
      complete() {
        if (!installed || completed) return;
        completed = true;
        let failed = false; let first: unknown;
        const attempt = (body: () => void) => { try { body(); } catch (error) { if (!failed) { failed = true; first = error; } } };
        try {
          for (const delivery of observations) attempt(delivery);
          attempt(() => { if (publication.unit) entityPublication.complete(publication.unit.completion); });
          attempt(() => { membershipTap?.(MEMBERSHIP_FACTS, frame.mutations); });
          for (const mutation of frame.mutations) {
            if (mutation.kind === 'retire-retained-value' && mutation.forgetLifetime) {
              const subject = mutation.subjectId;
              entityPublication.requestRetirement(subject, () => resolveSubjectState(subject) === undefined && !ordinaryTopology.retains(subject));
            }
          }
          const removed = [...new Set(frame.mutations.filter(mutation => mutation.kind === 'tombstone-subject').map(mutation => mutation.subjectId))];
          attempt(() => reclaimRetiredSubjectsWithoutOwner(removed));
        } finally { observations.length = 0; }
        if (failed) throw first;
      },
    };
  }
''' +s[b:]
s=s.replace('''  ): ((changes: readonly CommittedEntityMutation[]) => void) | undefined {''','''  ): ((changes: readonly CommittedEntityMutation[], deferObservation?: (delivery: () => void) => void) => void) | undefined {''')
s=s.replace('''    return (changes) =>
      mutationCaptureRuntime.publishCommittedEntity?.({''','''    return (changes, deferObservation) =>
      mutationCaptureRuntime.publishCommittedEntity?.({''')
s=s.replace('''        structuralRecords,
        meta,
      });''','''        structuralRecords,
        meta,
      }, deferObservation);''')
p.write_text(s)
