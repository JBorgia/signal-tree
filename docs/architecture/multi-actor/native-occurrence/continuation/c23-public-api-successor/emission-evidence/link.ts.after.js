import { scalarPublicationCovers, scalarNotificationContributions } from './internals/scalar-publication-coverage';
import './experimental-publication/entity';
import { entityPublicationOrdinary, entityPublicationUnit, getEntityPublicationBinding } from './internals/entity-publication';
import { entityValueTransition } from './internals/entity-value-transition';
import { combineTerminalRecords } from './internals/intrinsic-mutation';
import { getRetainedMembershipPath } from './internals/member-membership';
import { hasSelectedEntityDisposition } from './internals/selected-entity-disposition';
import { ordinaryEntityEntries } from './internals/ordinary-entity-entries';
import * as research from './experimental-publication/private';
import { applyPlainBranchMembership, plainBranchMembershipChange, } from './internals/plain-branch-membership';
import { isWritableLocation, replaceLocation, } from './internals/location-runtime';
import { deepEqual } from './utils';
import { external } from './external';
import { getOwnedOwnerPath, getOwnedPositionIds, } from './internals/owned-metadata';
import { getPathNotifier } from './path-notifier';
import { reportTreeError } from './internals/error-reporter';
import { getPositionRegistry, getNodeAddress, } from './internals/position-registry';
import { acquireObservation } from './internals/observation-substrate';
import { registerLinkState } from './internals/link-state-source';
import { isInspectionWrite } from './write-participation';
import { getEntityProjectionSeed, getEntityLocationBinding, } from './internals/entity-projection-seed';
import { getMutationCaptureRuntime } from './internals/mutation-capture-runtime';
import { createEntityEgressProjection, projectEntityFields, } from './internals/entity-egress-projection';
import { applyAtRelativePath, relativeSourceAddress, } from './internals/source-mutation';
import { isNodeAccessor, isTraversableNode } from './internals/node-shape';
import { getRootTree } from './internals/root-source';
import { scheduleDurableConsequence, withdrawHeldConsequence, } from './internals/commit-consequence';
function applyCollectionNotification(projection, subject, row, effect, inspection, fields, meta) {
    if (!hasSelectedEntityDisposition(meta))
        return projection.apply(subject, row, effect, inspection, fields);
    projection.apply(subject, row, effect, true, fields);
    if (inspection)
        return false;
    let advanced = false;
    for (const entry of ordinaryEntityEntries({
        path: '',
        newValue: row,
        oldValue: undefined,
        subjectIds: subject === undefined ? undefined : [subject],
        meta,
    }))
        advanced =
            projection.apply(entry.subjectIds?.[0], entry.newValue, entry.meta?.structuralEffect, false, fields, true) || advanced;
    return advanced;
}
function accessorsFor(x) {
    const node = x;
    const rootTree = getRootTree(x);
    if (rootTree) {
        return {
            read: () => rootTree.read(),
            write: (v) => rootTree.replace(v),
            collection: false,
        };
    }
    if (isNodeAccessor(x)) {
        return {
            read: () => x(),
            write: (value) => x(value),
            collection: false,
        };
    }
    const all = node.all;
    const setAll = node.setAll;
    if (typeof all === 'function' && typeof setAll === 'function') {
        return {
            read: () => all(),
            write: (v) => setAll(v),
            collection: true,
        };
    }
    if (isWritableLocation(x)) {
        return {
            read: () => x(),
            write: (value) => replaceLocation(x, value),
            collection: false,
        };
    }
    return {
        read: () => x(),
        write: (v) => x(v),
        collection: false,
    };
}
export function link(source, endpoint) {
    const x = source;
    const registry = getPositionRegistry(x);
    if (!registry) {
        throw new Error('link: X must be an owned SignalTree location. A bare signal() or ' +
            'computed() has no owning tree, so there is nothing to settle against.');
    }
    if (!endpoint.get && !endpoint.set && !endpoint.subscribe) {
        throw new Error('link: the endpoint must supply at least one of get, set or ' +
            'subscribe — a link with no direction synchronizes nothing.');
    }
    const { read, write, collection } = accessorsFor(x);
    const entityLocation = getEntityLocationBinding(x);
    const sourceAddress = getNodeAddress(x);
    if (!entityLocation && sourceAddress === undefined) {
        throw new Error('link: the owned source has no structured address.');
    }
    const releaseObservation = acquireObservation(x);
    const ownerPath = getOwnedOwnerPath(x) ?? '';
    const notifier = getPathNotifier();
    const publicationPosition = entityLocation?.owner ?? getOwnedPositionIds(x)?.[0] ?? -1;
    let knownY;
    let disposed = false;
    let dirty = false;
    let chain = Promise.resolve();
    let inboundSeq = 0;
    let eligible = read();
    let researchFact;
    const seedCollectionProjection = (node) => {
        const source = getEntityPublicationBinding(node)?.source, revision = source?.revision();
        const seed = getEntityProjectionSeed(node) ?? [];
        const facts = research.baselineEntityEvidence(source?.evidence(), registry.id);
        const result = createEntityEgressProjection(seed, undefined, facts);
        if (source?.revision() !== revision)
            throw new Error('Collection seed changed during preparation');
        return result;
    };
    const entityProjection = collection
        ? seedCollectionProjection(x)
        : undefined;
    if (entityProjection)
        eligible = entityProjection.value();
    const nestedCollections = new Map();
    const collectionSources = new Map();
    if (entityProjection)
        collectionSources.set(x, entityProjection);
    if (!collection && !entityLocation) {
        const discover = (node) => {
            if (!isTraversableNode(node))
                return;
            const seed = getEntityProjectionSeed(node);
            if (seed) {
                const position = getOwnedPositionIds(node)?.[0];
                const address = position === undefined ? undefined : registry.addressFor(position);
                const relative = sourceAddress !== undefined && address !== undefined
                    ? relativeSourceAddress(sourceAddress, address)
                    : undefined;
                if (position === undefined || relative === undefined)
                    return;
                const projection = seedCollectionProjection(node);
                nestedCollections.set(position, {
                    node,
                    projection,
                    relativeAddress: relative,
                });
                collectionSources.set(node, projection);
                return;
            }
            for (const key of Object.keys(node)) {
                discover(node[key]);
            }
        };
        discover(x);
    }
    const advanceNested = (nested) => {
        eligible = applyAtRelativePath(eligible, nested.relativeAddress, {
            all: nested.projection.value(),
        });
    };
    const held = new Set();
    const consequenceKey = {};
    const sendConsequenceKey = {};
    const waitingSends = new Set();
    const settlementWaiters = new Set();
    const pendingOrders = new Set();
    const retrievals = new Set();
    let queued = 0;
    let sending = false;
    const observeLink = registerLinkState(registry, x, ownerPath, endpoint, () => [
        dirty,
        held.size > 0 || waitingSends.size > 0,
        queued,
        sending,
        retrievals.size,
        disposed,
    ]);
    const acquire = (value, seq) => {
        if (disposed || seq < inboundSeq)
            return;
        inboundSeq = seq;
        knownY = { value };
        if (!entityProjection)
            eligible = value;
        research.acquire(consequenceKey, () => external(() => write(value)));
    };
    const ownEntitySource = getEntityPublicationBinding(x);
    research.bindSource(consequenceKey, registry.id, publicationPosition, {
        supported: collection || isWritableLocation(x) || isNodeAccessor(x) || !!getRootTree(x) || !!ownEntitySource,
        subject: entityLocation?.subjectId,
        field: entityLocation?.fieldKey,
    }, (error) => reportTreeError({
        error,
        operation: 'link:declare',
        treeId: registry.id,
        path: ownerPath || undefined,
    }), x, sourceAddress ? { registry, address: sourceAddress, value: eligible, aggregate: !isWritableLocation(x), presence: getRetainedMembershipPath(x) } : undefined);
    const releaseEntityPublications = [];
    const registerEntityRecipient = (node, projection, nested) => {
        const binding = getEntityPublicationBinding(node);
        if (!binding)
            return;
        if (projection)
            research.registerCollectionProjection(consequenceKey, node, nested?.relativeAddress, projection.support(), projection.value());
        releaseEntityPublications.push(binding.source.subscribe({
            seedRequested: () => !!projection && research.acquiringCollection(consequenceKey, node),
            prepare(packet, native) {
                const support = native?.support;
                const prepared = native;
                const acquired = !!projection && research.acquiringCollection(consequenceKey, node) && packet.seed !== undefined;
                const staged = acquired ? projection.prepareSeed(packet.seed, research.acquiredEntityEvidence()) : projection?.prepare(packet, prepared?.facts);
                let next = staged?.value;
                let changed = staged?.changed ?? false;
                if (!projection) {
                    next = eligible;
                    for (const edit of entityPublicationOrdinary(packet)) {
                        if (edit.subject !== binding.subject)
                            continue;
                        if (edit.structural?.kind === 'remove') {
                            next = undefined;
                            changed = true;
                            continue;
                        }
                        if (edit.structural?.kind === 'rekey')
                            continue;
                        if (binding.field !== undefined) {
                            if (edit.fields !== null && !edit.fields.includes(binding.field))
                                continue;
                            next = edit.after !== null && typeof edit.after === 'object' && Object.prototype.hasOwnProperty.call(edit.after, binding.field) ? edit.after[binding.field] : undefined;
                        }
                        else
                            next = projectEntityFields(next, edit.after, edit.fields);
                        changed = true;
                    }
                }
                const before = eligible;
                const after = nested ? applyAtRelativePath(eligible, nested.relativeAddress, { all: next }) : next;
                const affected = acquired || !!staged?.supportEdits.length || !!packet.ordinaryOrder || entityPublicationOrdinary(packet).some(edit => binding.subject === undefined || edit.subject === binding.subject && (edit.structural?.kind === 'remove' || binding.field === undefined || edit.fields === null || edit.fields.includes(binding.field)));
                const receipt = affected && prepared?.requirement ? research.prepareSourceProjection(consequenceKey, { intent: 'replace', before: nested ? nested.projection.value() : before, after: nested ? next : after, changed }, prepared.requirement, undefined, projection ? { key: node, edits: staged?.supportEdits ?? [], acquired } : undefined, !projection ? support?.(binding.subject, binding.field) : undefined) : undefined;
                if (!staged && !receipt)
                    return;
                const install = { set(_key, _value) { if (changed) {
                        eligible = (nested ? applyAtRelativePath(eligible, nested.relativeAddress, { all: next }) : next);
                        dirty = true;
                    } } };
                return { record: combineTerminalRecords(staged?.record, receipt?.record, { writes: [{ map: install, key: undefined, value: undefined }], adds: [] }), completion: { receipt: receipt?.completion }, finalize: receipt?.finalize };
            },
            complete(value) { const receipt = value.receipt; if (receipt)
                research.completeSourceProjection(receipt); },
        }));
    };
    if (ownEntitySource)
        registerEntityRecipient(x, entityProjection);
    for (const nested of nestedCollections.values())
        registerEntityRecipient(nested.node, nested.projection, nested);
    const offSub = research.subscribeProjection(notifier, consequenceKey, (v, prev, _path, _o, _origin, subjectIds, _pos, meta, _scopes, _owner, fields) => {
        if (disposed || !endpoint.set)
            return;
        if (scalarPublicationCovers(meta, consequenceKey)) {
            dirty = true;
            observeLink();
            return;
        }
        if (entityValueTransition(meta)?.publicationUnit || entityPublicationUnit(meta))
            return;
        const m = (meta ?? {});
        if (m['ownerId'] !== registry.id)
            return;
        const membership = plainBranchMembershipChange(meta);
        if (membership) {
            if (entityLocation || isInspectionWrite(meta))
                return;
            if (research.enabled) {
                dirty = true;
                observeLink();
                return;
            }
            const address = getNodeAddress(membership.branch);
            const relative = sourceAddress !== undefined && address !== undefined
                ? relativeSourceAddress(sourceAddress, address)
                : undefined;
            if (relative !== undefined) {
                eligible = applyPlainBranchMembership(eligible, relative, membership);
            }
            else {
                const below = sourceAddress !== undefined && address !== undefined
                    ? relativeSourceAddress(address, sourceAddress)
                    : undefined;
                const member = below?.length &&
                    membership.members.find(({ key }) => key === below[0]);
                if (!member || !below)
                    return;
                let value = member.after.present ? member.after.value : undefined;
                for (const key of below.slice(1))
                    value =
                        value !== null &&
                            typeof value === 'object' &&
                            Object.prototype.hasOwnProperty.call(value, key)
                            ? value[key]
                            : undefined;
                eligible = value;
                entityProjection?.reseed(getEntityProjectionSeed(x) ?? []);
            }
            for (const nested of nestedCollections.values()) {
                if (relative !== undefined &&
                    !membership.members.some(({ key }) => nested.relativeAddress[relative.length] === key &&
                        relative.every((step, at) => nested.relativeAddress[at] === step)))
                    continue;
                nested.projection.reseed(getEntityProjectionSeed(nested.node) ?? []);
                let at = eligible;
                for (const key of nested.relativeAddress.slice(0, -1))
                    at =
                        at !== null && typeof at === 'object'
                            ? at[key]
                            : undefined;
                if (at !== null &&
                    typeof at === 'object' &&
                    Object.prototype.hasOwnProperty.call(at, nested.relativeAddress[nested.relativeAddress.length - 1]))
                    advanceNested(nested);
            }
            dirty = true;
            observeLink();
            return;
        }
        if (v === undefined && prev === undefined)
            return;
        if (entityLocation) {
            if (_pos?.[0] !== entityLocation.owner ||
                subjectIds?.[0] !== entityLocation.subjectId ||
                isInspectionWrite(meta))
                return;
            const effect = meta?.structuralEffect;
            if (effect?.kind === 'rekey')
                return;
            const removed = effect?.kind === 'remove';
            const footprint = effect?.kind === 'add' ? null : fields;
            if (!removed && footprint === undefined)
                return;
            if (entityLocation.fieldKey !== undefined) {
                if (!removed &&
                    footprint !== null &&
                    !footprint?.includes(entityLocation.fieldKey))
                    return;
                eligible = (v != null &&
                    Object.prototype.hasOwnProperty.call(v, entityLocation.fieldKey)
                    ? v[entityLocation.fieldKey]
                    : undefined);
            }
            else {
                const next = removed
                    ? undefined
                    : projectEntityFields(eligible, v, footprint);
                if (next === eligible)
                    return;
                eligible = next;
            }
            researchFact = research.evidence(meta);
            researchFact = research.project(consequenceKey, meta, eligible);
            dirty = true;
            observeLink();
            return;
        }
        const position = _pos?.[0];
        const address = position === undefined ? undefined : registry.addressFor(position);
        const relative = sourceAddress !== undefined && address !== undefined
            ? relativeSourceAddress(sourceAddress, address)
            : undefined;
        if (relative === undefined)
            return;
        const inspection = isInspectionWrite(meta);
        const nested = position === undefined ? undefined : nestedCollections.get(position);
        if (nested) {
            const effect = meta?.['structuralEffect'];
            const advanced = applyCollectionNotification(nested.projection, subjectIds?.[0], v, effect, inspection, fields, meta);
            if (advanced) {
                advanceNested(nested);
                dirty = true;
                observeLink();
            }
            return;
        }
        if (entityProjection) {
            const effect = meta?.['structuralEffect'];
            const advanced = applyCollectionNotification(entityProjection, subjectIds?.[0], v, effect, inspection, fields, meta);
            if (advanced) {
                dirty = true;
                observeLink();
            }
            return;
        }
        if (inspection)
            return;
        const contributions = scalarNotificationContributions(meta);
        if (contributions) {
            for (const contribution of contributions) {
                if (scalarPublicationCovers(contribution.meta, consequenceKey) ||
                    !research.scalarContributionIsCurrent(consequenceKey, relative, contribution.revision))
                    continue;
                const receipt = research.projectScalarContribution(consequenceKey, contribution.value, relative, contribution.revision);
                if (receipt)
                    adoptResearchProjection(receipt);
            }
        }
        else {
            researchFact = relative.length === 0 ? research.evidence(meta) : undefined;
            eligible = applyAtRelativePath(eligible, relative, v);
            researchFact = research.project(consequenceKey, meta, eligible, relative);
        }
        dirty = true;
        observeLink();
    });
    const researchHold = () => {
        if (held.size > 0 || disposed)
            return;
        let resolve;
        const promise = new Promise((r) => (resolve = r));
        held.add({ promise, resolve });
    };
    const sendEligible = () => new Promise((resolve, reject) => {
        const cancel = () => {
            waitingSends.delete(cancel);
            resolve(false);
        };
        waitingSends.add(cancel);
        const attempt = () => {
            if (disposed) {
                cancel();
                return;
            }
            let synchronous = true;
            try {
                const researchTicket = researchFact;
                const now = entityProjection && !research.enabled
                    ? entityProjection.value()
                    : eligible;
                if (knownY !== undefined && deepEqual(now, knownY.value)) {
                    cancel();
                    return;
                }
                const researchAdmitted = research.admit(scheduleDurableConsequence, researchTicket, registry.id, publicationPosition, consequenceKey, {
                    claimant: x,
                    key: sendConsequenceKey,
                    run: () => {
                        if (!synchronous) {
                            queueMicrotask(attempt);
                            return;
                        }
                        waitingSends.delete(cancel);
                        sending = true;
                        try {
                            observeLink();
                        }
                        catch (error) {
                            sending = false;
                            throw error;
                        }
                        if (!disposed &&
                            !research.allowed(researchTicket, registry.id, publicationPosition, consequenceKey)) {
                            sending = false;
                            researchHold();
                            cancel();
                            return;
                        }
                        if (disposed) {
                            sending = false;
                            resolve(false);
                            return;
                        }
                        try {
                            research.started(researchTicket, consequenceKey);
                            Promise.resolve(endpoint.set?.(now)).then(() => {
                                sending = false;
                                knownY = { value: now };
                                resolve(true);
                            }, (error) => {
                                sending = false;
                                reject(error);
                            });
                        }
                        catch (error) {
                            sending = false;
                            reject(error);
                        }
                    },
                });
                if (!researchAdmitted) {
                    researchHold();
                    cancel();
                }
                if (waitingSends.has(cancel))
                    observeLink();
            }
            catch (error) {
                waitingSends.delete(cancel);
                reject(error);
            }
            finally {
                synchronous = false;
            }
        };
        attempt();
    });
    const flushOutbound = () => {
        if (disposed || !dirty)
            return;
        dirty = false;
        let entry = held.values().next().value;
        if (!entry) {
            let resolve;
            const promise = new Promise((r) => (resolve = r));
            entry = { promise, resolve };
            held.add(entry);
        }
        const pending = entry;
        research.admit(scheduleDurableConsequence, researchFact, registry.id, publicationPosition, consequenceKey, {
            claimant: x,
            key: consequenceKey,
            run: () => {
                held.delete(pending);
                pending.resolve();
                if (disposed)
                    return;
                queued++;
                chain = chain
                    .then(async () => {
                    queued--;
                    try {
                        for (;;) {
                            if (disposed)
                                return;
                            if (!(await sendEligible()))
                                return;
                        }
                    }
                    finally {
                        observeLink();
                    }
                })
                    .catch((error) => {
                    observeLink('send-failed');
                    reportTreeError({
                        error,
                        operation: 'link:set',
                        treeId: registry.id,
                        path: ownerPath === '' ? undefined : ownerPath,
                    });
                });
                observeLink();
            },
        });
        observeLink();
    };
    function adoptResearchProjection(receipt) {
        researchFact = receipt.fact;
        eligible = receipt.payload;
        if (receipt.changed)
            dirty = true;
        research.acknowledgeProjection(consequenceKey, receipt);
    }
    const researchRefresh = () => {
        const receipt = research.refreshSource(consequenceKey);
        if (receipt)
            adoptResearchProjection(receipt);
    };
    const offFlush = notifier.onFlush?.(() => {
        researchRefresh();
        flushOutbound();
    });
    const offResearchEligibility = research.onEligibility(registry.id, () => {
        if (!disposed)
            researchRefresh();
        if (disposed ||
            (!dirty && held.size === 0) ||
            research.pendingDecision(researchFact, consequenceKey))
            return;
        dirty = true;
        flushOutbound();
    }, consequenceKey);
    const releaseOrders = [];
    for (const [node, projection] of collectionSources) {
        const capture = getMutationCaptureRuntime(node);
        if (!capture?.subscribeCollectionOrder)
            continue;
        const releaseCapture = capture.activateCapture();
        const offOrder = capture.subscribeCollectionOrder((order) => {
            if (disposed || order.owner !== getOwnedPositionIds(node)?.[0] || entityPublicationUnit(order.meta))
                return;
            const inspection = isInspectionWrite(order.meta);
            let resolve;
            const promise = new Promise((r) => (resolve = r));
            const pending = { promise, resolve };
            pendingOrders.add(pending);
            queueMicrotask(() => {
                try {
                    const selected = hasSelectedEntityDisposition(order.meta);
                    if (selected)
                        projection.reorder(order.afterSubjects, true);
                    const advanced = selected
                        ? order.ordinaryEndpoints !== undefined &&
                            projection.reorder(order.ordinaryEndpoints.after, inspection, true)
                        : projection.reorder(order.afterSubjects, inspection);
                    if (disposed || !advanced)
                        return;
                    if (projection !== entityProjection) {
                        const nested = nestedCollections.get(order.owner);
                        if (nested)
                            advanceNested(nested);
                    }
                    dirty = true;
                    observeLink();
                    flushOutbound();
                }
                finally {
                    pendingOrders.delete(pending);
                    pending.resolve();
                }
            });
        });
        releaseOrders.push(() => {
            offOrder();
            releaseCapture();
        });
    }
    let offSource;
    const dispose = () => {
        if (disposed)
            return;
        disposed = true;
        offResearchEligibility();
        for (const release of releaseEntityPublications)
            release();
        research.dispose(consequenceKey, sendConsequenceKey);
        releaseObservation();
        offSub();
        offFlush?.();
        withdrawHeldConsequence(x, consequenceKey);
        withdrawHeldConsequence(x, sendConsequenceKey);
        for (const release of releaseOrders)
            release();
        for (const h of held)
            h.resolve();
        held.clear();
        for (const cancel of waitingSends)
            cancel();
        waitingSends.clear();
        for (const release of settlementWaiters)
            release();
        settlementWaiters.clear();
        for (const order of pendingOrders)
            order.resolve();
        pendingOrders.clear();
        for (const r of retrievals)
            r.resolve();
        retrievals.clear();
        observeLink('disposed');
        offSource?.();
    };
    try {
        offSource = endpoint.subscribe?.((v) => acquire(v, ++inboundSeq));
    }
    catch (error) {
        observeLink(null);
        dispose();
        throw error;
    }
    observeLink('created');
    const experimental = {
        declare: (declaration, work) => research.declare(consequenceKey, registry.id, publicationPosition, declaration, work, () => disposed),
        async retrieve() {
            if (!endpoint.get) {
                throw new Error('link: endpoint supplies no get().');
            }
            const seq = ++inboundSeq;
            let resolve;
            const promise = new Promise((r) => (resolve = r));
            const entry = { promise, resolve };
            retrievals.add(entry);
            observeLink();
            try {
                if (disposed)
                    return;
                acquire((await endpoint.get()), seq);
            }
            catch (error) {
                observeLink('retrieve-failed');
                throw error;
            }
            finally {
                retrievals.delete(entry);
                entry.resolve();
                observeLink();
            }
        },
        async settled() {
            for (;;) {
                const installedWork = research.pendingWork(consequenceKey);
                if (installedWork.length) {
                    await Promise.all(installedWork);
                    continue;
                }
                if (disposed)
                    return;
                if (retrievals.size > 0) {
                    await Promise.race([...retrievals].map((r) => r.promise));
                    continue;
                }
                const awaitedChain = chain;
                await new Promise((resolve, reject) => {
                    const release = () => {
                        settlementWaiters.delete(release);
                        resolve();
                    };
                    settlementWaiters.add(release);
                    void awaitedChain.then(release, (error) => {
                        settlementWaiters.delete(release);
                        reject(error);
                    });
                });
                if (disposed)
                    return;
                if (retrievals.size > 0)
                    continue;
                if (pendingOrders.size > 0) {
                    await Promise.race([...pendingOrders].map((order) => order.promise));
                    continue;
                }
                if (chain !== awaitedChain)
                    continue;
                if (held.size === 0) {
                    if (!notifier.hasPending())
                        break;
                    await new Promise((resolve) => {
                        const off = notifier.onFlush(() => {
                            off();
                            resolve();
                        });
                    });
                    continue;
                }
                await Promise.race([...held].map((h) => h.promise));
            }
        },
        dispose,
    };
    return experimental;
}
