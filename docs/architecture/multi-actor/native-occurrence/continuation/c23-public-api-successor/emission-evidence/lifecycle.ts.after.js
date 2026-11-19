import { isTraversableNode } from '../internals/node-shape';
const sources = new Map();
const authentic = new WeakMap();
const pending = new Set();
const queuedConnections = new Set();
let wakeQueued = false;
export function registerOwnerSource(owner, token) { if (!sources.has(owner))
    sources.set(owner, { token, cells: new Map() }); }
export function ownerToken(owner) { return sources.get(owner)?.token; }
export function ownerCell(owner, id) { return sources.get(owner)?.cells.get(id); }
export function pendingOwners() { return [...pending]; }
function wake(channel) { queuedConnections.add(channel); if (wakeQueued)
    return; wakeQueued = true; queueMicrotask(() => { wakeQueued = false; const queued = [...queuedConnections]; queuedConnections.clear(); for (const key of queued) {
    const c = connections.get(key);
    if (c) {
        for (const op of c.ops.values())
            refresh(op);
        c.wake();
    }
} }); }
function ownerWake(cell) { for (const op of cell.dependents)
    wake(op.channel); }
const ownerTransitionObservers = new WeakMap();
function queueOwnerObserver(observer) {
    if (observer.queued || !observer.callback)
        return;
    observer.queued = true;
    queueMicrotask(() => { observer.queued = false; observer.callback?.(); });
}
function notifyOwnerTransition(cell) {
    for (const observer of ownerTransitionObservers.get(cell) ?? [])
        queueOwnerObserver(observer);
}
export function ownerCellCanTransition(cell) {
    return cell.outcome === 'pending' && sources.get(cell.owner)?.cells.get(cell.id) === cell;
}
export function onOwnerCellTransition(cell, callback) {
    let observers = ownerTransitionObservers.get(cell);
    if (!observers)
        ownerTransitionObservers.set(cell, observers = new Set());
    const observer = { callback, queued: false };
    observers.add(observer);
    if (!ownerCellCanTransition(cell))
        queueOwnerObserver(observer);
    let active = true;
    return () => {
        if (!active)
            return;
        active = false;
        observer.callback = undefined;
        observers.delete(observer);
        if (!observers.size && ownerTransitionObservers.get(cell) === observers)
            ownerTransitionObservers.delete(cell);
    };
}
export function ownerTransition(owner, event) {
    const source = sources.get(owner);
    if (!source)
        return;
    let cell = source.cells.get(event.transactionId);
    if (!cell) {
        if (event.kind !== 'opened' && event.kind !== 'staged')
            return;
        cell = { owner, id: event.transactionId, outcome: 'pending', dependents: new Set() };
        source.cells.set(cell.id, cell);
    }
    if (event.kind === 'opened' || event.kind === 'staged') {
        if (cell.outcome === 'pending')
            pending.add(cell);
        return;
    }
    if (!['confirmed', 'rolled-back', 'abandoned'].includes(event.kind))
        return;
    const outcome = event.kind;
    if (cell.outcome !== 'pending' && cell.outcome !== outcome)
        throw Error('Terminal publication dependency outcome reversed');
    cell.outcome = outcome;
    pending.delete(cell);
    const retired = cell;
    queueMicrotask(() => { if (source.cells.get(retired.id) === retired && retired.outcome !== 'pending')
        source.cells.delete(retired.id); });
    ownerWake(cell);
    notifyOwnerTransition(cell);
}
export function abandonOwnerSource(owner) {
    const source = sources.get(owner);
    if (!source)
        return;
    for (const cell of source.cells.values()) {
        pending.delete(cell);
        ownerWake(cell);
        notifyOwnerTransition(cell);
    }
    source.cells.clear();
    sources.delete(owner);
}
export function enroll(handle, owner, id) {
    if (owner !== undefined) {
        const cell = ownerCell(owner, id);
        if (cell)
            authentic.set(handle, cell);
    }
    return handle;
}
const uniqueOwners = (owners) => Object.freeze([...new Set(owners)]);
export function combineProofs(parts) {
    return { owners: uniqueOwners(parts.flatMap(p => p?.owners ?? [])),
        destination: uniqueOwners(parts.flatMap(p => p?.destination ?? [])),
        input: uniqueOwners(parts.flatMap(p => p?.input ?? [])),
        validation: uniqueOwners(parts.flatMap(p => p?.validation ?? [])),
        possible: uniqueOwners(parts.flatMap(p => p?.possible ?? [])),
        terminalRejectedRoles: parts.reduce((bits, p) => bits | (p?.terminalRejectedRoles ?? 0), 0),
        unavailableInput: parts.some(p => p?.unavailableInput === true),
        historicalWindow: parts.some(p => p?.historicalWindow === true),
        unknown: parts.some(p => !p || p.unknown), invalid: parts.some(p => p?.invalid === true) };
}
const unfinishedRequirements = new WeakSet();
const unactivatedRequirements = new WeakSet();
const requirementListeners = new WeakMap();
export function nativeRequirementReady(requirement) {
    return !unfinishedRequirements.has(requirement) && !unactivatedRequirements.has(requirement) && (requirement.components ?? []).every(nativeRequirementReady);
}
export function combineNativeRequirements(components) {
    const sources = Object.freeze([...new Set(components)]);
    return { components: sources, get proof() { return combineProofs(sources.map(nativeProof)); }, inputs: [], frames: [], known: [], unknown: false, possible: [], captureWindow: false };
}
export function onNativeRequirementReady(requirement, callback) {
    if (nativeRequirementReady(requirement) && !unactivatedRequirements.has(requirement)) {
        callback();
        return () => { };
    }
    let active = true;
    const releases = [];
    const release = () => { active = false; for (const off of releases)
        off(); releases.length = 0; };
    const check = () => { if (active && nativeRequirementReady(requirement) && !unactivatedRequirements.has(requirement)) {
        release();
        callback();
    } };
    const visit = (part) => {
        if (unfinishedRequirements.has(part) || unactivatedRequirements.has(part)) {
            let listeners = requirementListeners.get(part);
            if (!listeners)
                requirementListeners.set(part, listeners = new Set());
            listeners.add(check);
            releases.push(() => { listeners.delete(check); if (!listeners.size)
                requirementListeners.delete(part); });
        }
        for (const child of part.components ?? [])
            visit(child);
    };
    visit(requirement);
    return release;
}
function notifyRequirement(requirement) {
    const callbacks = requirementListeners.get(requirement);
    requirementListeners.delete(requirement);
    let failed = false, first;
    for (const callback of [...callbacks ?? []])
        try {
            callback();
        }
        catch (error) {
            if (!failed) {
                failed = true;
                first = error;
            }
        }
    if (failed)
        throw first;
}
export function captureNativeInput(requirement) {
    const proof = nativeProof(requirement);
    return Object.freeze({ requirement, owners: Object.freeze(proof.owners.filter(owner => owner.outcome !== 'confirmed')), terminalRejectedRoles: proof.terminalRejectedRoles ?? 0 });
}
export function nativeProof(requirement) {
    const p = requirement.proof;
    if (p)
        return p;
    const inputs = requirement.inputs.map(input => nativeProof(input.requirement));
    const validation = requirement.frames.map(effective);
    const input = uniqueOwners(requirement.inputs.flatMap(input => input.owners));
    const declared = uniqueOwners(validation.flatMap(p => p.owners));
    const ownWindow = requirement.captureWindow || requirement.frames.some(frameInvalid)
        ? requirement.possible : [];
    return { destination: requirement.known, input, validation: declared,
        owners: uniqueOwners([...requirement.known, ...input, ...declared]),
        possible: uniqueOwners([...ownWindow, ...inputs.flatMap(p => p.possible ?? [])]),
        terminalRejectedRoles: requirement.inputs.some(input => (input.terminalRejectedRoles ?? 0) !== 0) ? 2 : 0,
        unavailableInput: false,
        historicalWindow: requirement.captureWindow || inputs.some(p => p.historicalWindow === true),
        unknown: requirement.unknown || ownWindow.length > 0 || inputs.some(p => p.unknown) || validation.some(p => p.unknown),
        invalid: inputs.some(p => p.invalid) || validation.some(p => p.invalid) };
}
export function initialRequirement() { return { proof: { owners: [], unknown: false, invalid: false }, inputs: [], frames: [], known: [], unknown: false, possible: [], captureWindow: false }; }
export function unavailableRequirement() {
    return { proof: { owners: [], unknown: true, invalid: false, unavailableInput: true }, inputs: [], frames: [], known: [], unknown: true, possible: [], captureWindow: false };
}
export function prepareNativeRequirement(known, unknown, inputs) {
    const active = [...stack];
    const captureWindow = active.length === 0 || active.some(f => f.declaredOwners === undefined)
        || inputs.some(input => nativeProof(input.requirement).unavailableInput === true);
    const requirement = { retirementOwnWindowOnly: !unknown && known.length === 0 && inputs.length === 0 && active.length === 0, known: Object.freeze([...known]), unknown, inputs: Object.freeze([...inputs]), frames: active, possible: [], captureWindow };
    unfinishedRequirements.add(requirement);
    unactivatedRequirements.add(requirement);
    const evidence = nativeProof(requirement);
    const adds = [];
    for (const frame of active) {
        for (const owner of [...(evidence.input ?? []), ...(evidence.validation ?? [])])
            adds.push({ set: frame.installedOwners, value: owner });
        if (frame.declaredOwners !== undefined && ((evidence.terminalRejectedRoles ?? 0) !== 0 || [...(evidence.input ?? []), ...(evidence.validation ?? [])].some(owner => !frame.declaredOwners.includes(owner))))
            adds.push({ set: invalidFrames, value: frame });
        if (evidence.unknown)
            adds.push({ set: unknownFrames, value: frame });
    }
    const h = active.at(-1)?.horizon;
    if (h)
        adds.push({ set: h.requirements, value: requirement });
    return { requirement, record: { writes: [], adds } };
}
export function finalizeNativeRequirement(requirement) {
    const actualInputs = new Set(requirement.inputs.flatMap(input => input.owners));
    const destination = new Set(requirement.known);
    requirement.possible = Object.freeze([...pending].filter(owner => !destination.has(owner) && !actualInputs.has(owner)));
    if (requirement.frames.length === 0) {
        requirement.proof = nativeProof(requirement);
        requirement.inputs = [];
        requirement.known = [];
        unfinishedRequirements.delete(requirement);
    }
}
export function deliverNativeRequirementReady(requirement) {
    if (!requirement || !unactivatedRequirements.delete(requirement))
        return;
    if (nativeRequirementReady(requirement))
        notifyRequirement(requirement);
}
const connections = new Map();
const stack = [];
const installedLast = new Map();
const unknownFrames = new Set();
const invalidFrames = new Set();
const frameOwners = (f) => [...new Set([...f.owners, ...f.installedOwners])];
const frameUnknown = (f) => f.unknown || unknownFrames.has(f);
const frameInvalid = (f) => f.invalid || invalidFrames.has(f);
const frameLast = (f) => installedLast.get(f) ?? f.last;
let reporting = false;
export class SignalTreePublicationError extends Error {
    stage;
    reason;
    code = 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID';
    constructor(stage, reason, options) {
        super(`Declaration invalid: ${reason}; writes may remain`);
        this.stage = stage;
        this.reason = reason;
        if (options && 'cause' in options)
            Object.defineProperty(this, 'cause', { value: options.cause, writable: true, configurable: true });
    }
}
export function registerConnection(channel, options) {
    if (connections.has(channel))
        throw Error('Publication connection already registered');
    connections.set(channel, { ...options, ops: new Map(), disposed: false });
}
function state(view, value) { if (['started', 'superseded', 'disposed', 'no-write'].includes(view.value.state))
    return; view.value = Object.freeze(value); }
function effective(frame) { const all = [...frame.parents, frame]; const validation = uniqueOwners(all.flatMap(frameOwners)); return { owners: validation, validation, unknown: all.some(frameUnknown), invalid: all.some(frameInvalid) }; }
function setOperationState(op, value) { for (const view of op.views)
    state(view, value); }
function refresh(op) {
    if (op.started)
        return;
    if (op.frames.size || op.projectionPending) {
        for (const view of op.views)
            state(view, { state: 'validating' });
        return;
    }
    const p = op.proof;
    if (!p)
        return;
    if (p.invalid || p.unknown) {
        setOperationState(op, { state: 'conservative', reason: p.invalid ? 'invalid-declaration' : 'unknown' });
        return;
    }
    if ((p.terminalRejectedRoles ?? 0) !== 0 || p.owners.some(x => x.outcome === 'rolled-back' || x.outcome === 'abandoned')) {
        setOperationState(op, { state: 'conservative', reason: 'rejected-dependency' });
        return;
    }
    setOperationState(op, p.owners.some(x => x.outcome === 'pending') ? { state: 'held', reason: 'pending-dependency' } : { state: 'eligible', basis: 'declared' });
}
export function prepareRevision(channel, revision, known, uncertainty = {}, blockers = [], native, projectionPending = false) {
    const c = connections.get(channel);
    const writes = [];
    const adds = [];
    const deletes = [];
    if (!c || c.disposed)
        return { writes, adds };
    const unknown = !!(uncertainty.unobservedOrigin || uncertainty.invalidAttribution || uncertainty.uncapturedUpdaterInput || uncertainty.recipientDomain);
    const unobservedAuthorship = !!(uncertainty.unobservedOrigin || uncertainty.invalidAttribution || uncertainty.uncapturedUpdaterInput);
    const active = [...stack];
    const matches = active.filter(f => f.channel === channel);
    const nativeEvidence = native ? nativeProof(native) : undefined;
    const required = uniqueOwners([...active.flatMap(frameOwners), ...(nativeEvidence?.input ?? []), ...(nativeEvidence?.validation ?? [])]);
    const op = { declared: matches.length !== 0, recipientWindow: [], incomplete: (!native && matches.length === 0) || unobservedAuthorship || active.some(frame => frame.declaredOwners === undefined), projectionPending, native, coverageUnknown: unknown, channel, dependencies: new Set([...known, ...required, ...(nativeEvidence?.owners ?? []), ...(nativeEvidence?.possible ?? []), ...blockers]), revision, frames: new Set(), views: new Set(), started: false, surviving: false, noopFallbacks: new Map() };
    if (matches.length === 0)
        op.proof = { owners: Object.freeze([...known]), destination: Object.freeze([...known]), unknown: unknown || !native, invalid: false };
    writes.push({ map: c.ops, key: revision, value: op });
    for (const cell of op.dependencies)
        adds.push({ set: cell.dependents, value: op });
    for (const frame of active) {
        const declared = frame.declaredOwners;
        if (declared !== undefined && required.some(owner => !declared.includes(owner)))
            adds.push({ set: invalidFrames, value: frame });
    }
    for (const f of active) {
        const matching = matches.includes(f);
        const previous = frameLast(f);
        const old = previous && f.connection.ops.get(previous);
        if (matching && old) {
            deletes.push({ map: old.views, key: f.view });
            if (f.ops.has(old))
                op.noopFallbacks.set(f.view, old);
        }
        for (const cell of required)
            adds.push({ set: f.installedOwners, value: cell });
        if (active.some(frameUnknown))
            adds.push({ set: unknownFrames, value: f });
        if (matching)
            writes.push({ map: installedLast, key: f, value: revision });
        if (matching)
            adds.push({ set: op.frames, value: f }, { set: op.views, value: f.view }, { set: f.ops, value: op });
    }
    let finalized = false;
    return { writes, adds, deletes, finalize: () => {
            if (finalized || !op.incomplete)
                return;
            finalized = true;
            const actualInputs = new Set(native ? nativeProof(native).input ?? [] : []);
            const destination = new Set(known);
            op.recipientWindow = Object.freeze([...pending].filter(owner => !destination.has(owner) && !actualInputs.has(owner)));
            if (op.proof)
                op.proof = recipientProof(op, op.proof);
        } };
}
function recipientProof(op, proof) {
    if (!op.incomplete)
        return proof;
    return { ...proof, unknown: true, historicalWindow: true,
        possible: uniqueOwners([...(proof.possible ?? []), ...op.recipientWindow]) };
}
export function attachRevision(_channel, _revision, _known, _unknown = false) { }
export function proof(channel, revision) {
    const op = connections.get(channel)?.ops.get(revision);
    if (!op || op.frames.size)
        return undefined;
    return op.proof;
}
export function hasDeclaration(channel, revision) {
    return connections.get(channel)?.ops.get(revision)?.declared === true;
}
export function noWrite(channel, revision) {
    const c = connections.get(channel), op = c?.ops.get(revision);
    if (!op)
        return;
    for (const view of op.views) {
        let fallback = op.noopFallbacks.get(view);
        while (fallback && !c.ops.has(fallback.revision))
            fallback = fallback.noopFallbacks.get(view);
        if (fallback) {
            fallback.views.add(view);
            refresh(fallback);
        }
        else
            state(view, { state: 'no-write' });
    }
    op.views.clear();
    retire(op);
    c.ops.delete(revision);
}
export function keepRevision(channel, revision) { connections.get(channel)?.ops.get(revision)?.noopFallbacks.clear(); }
export function decision(channel, revision) {
    const op = connections.get(channel)?.ops.get(revision);
    if (!op)
        return { early: false, pending: false };
    if (op.frames.size || op.projectionPending)
        return { early: false, pending: true };
    const p = op.proof;
    return { early: !p.invalid && !p.unknown && !(p.terminalRejectedRoles ?? 0) && p.owners.every(x => x.outcome === 'confirmed'), pending: [...p.owners, ...(p.possible ?? [])].some(x => x.outcome === 'pending' || x.outcome === 'abandoned') };
}
function retire(op) { for (const cell of op.dependencies)
    cell.dependents.delete(op); }
export function started(channel, revision, basis = 'declared') {
    const op = connections.get(channel)?.ops.get(revision);
    if (!op)
        return;
    op.started = true;
    op.surviving = basis === 'surviving';
    setOperationState(op, { state: 'started', basis });
    retire(op);
    op.noopFallbacks.clear();
    op.proof = undefined;
    op.frames.clear();
    op.views.clear();
    connections.get(channel)?.ops.delete(revision);
}
export function supersede(channel, revision) {
    const c = connections.get(channel), op = c?.ops.get(revision);
    if (!op)
        return;
    if (!op.started)
        setOperationState(op, { state: 'superseded' });
    retire(op);
    c.ops.delete(revision);
}
export function disposeConnection(channel) {
    const c = connections.get(channel);
    if (!c)
        return;
    c.disposed = true;
    for (const op of c.ops.values()) {
        if (!op.started)
            setOperationState(op, { state: 'disposed' });
        retire(op);
    }
    c.ops.clear();
    connections.delete(channel);
}
function finish(h) {
    const deliveries = [...h.requirements];
    for (const requirement of h.requirements) {
        requirement.proof = nativeProof(requirement);
    }
    for (const requirement of h.requirements) {
        requirement.inputs = [];
        requirement.frames = [];
        requirement.known = [];
    }
    for (const requirement of h.requirements)
        unfinishedRequirements.delete(requirement);
    h.requirements.clear();
    const operations = new Set();
    for (const f of h.frames) {
        if (!frameLast(f))
            state(f.view, { state: f.connection.disposed ? 'disposed' : 'no-write' });
        for (const op of f.ops)
            operations.add(op);
    }
    for (const op of operations) {
        const proofs = [...op.frames].map(effective);
        if (op.native)
            proofs.push(nativeProof(op.native));
        op.proof = recipientProof(op, { ...combineProofs(proofs), unknown: op.coverageUnknown || proofs.some(p => p.unknown) });
        for (const cell of [...op.proof.owners, ...(op.proof.possible ?? [])]) {
            op.dependencies.add(cell);
            cell.dependents.add(op);
        }
        op.frames.clear();
        refresh(op);
        wake(op.channel);
    }
    for (const f of h.frames) {
        f.ops.clear();
        f.installedOwners.clear();
        installedLast.delete(f);
        unknownFrames.delete(f);
        invalidFrames.delete(f);
    }
    h.frames.clear();
    let failed = false, first;
    for (const requirement of deliveries)
        if (nativeRequirementReady(requirement))
            try {
                notifyRequirement(requirement);
            }
            catch (error) {
                if (!failed) {
                    failed = true;
                    first = error;
                }
            }
    if (failed)
        throw first;
}
export function runDeclaration(channel, input, work) {
    const c = connections.get(channel);
    if (!c || c.disposed)
        throw new SignalTreePublicationError('before-callback', 'disposed');
    if (!c.supported)
        throw new SignalTreePublicationError('before-callback', 'unsupported-source');
    const view = { value: Object.freeze({ state: 'validating' }) };
    const receipt = makeReceipt(view);
    const h = stack.at(-1)?.horizon ?? { frames: new Set(), requirements: new Set(), open: 0 };
    const frame = { channel, connection: c, parents: [...stack], horizon: h, owners: [], unknown: true, invalid: false, view, ops: new Set(), installedOwners: new Set() };
    h.frames.add(frame);
    h.open++;
    stack.push(frame);
    let stage = 'before-callback';
    let thrown = false;
    let primary;
    let exitingError = false;
    let completionFailed = false;
    let completionError;
    try {
        if (!isTraversableNode(input) || typeof input === 'function' || typeof work !== 'function')
            throw new SignalTreePublicationError(stage, 'malformed');
        const d = input;
        const kind = d.kind;
        if (kind !== 'independent' && kind !== 'dependent' && kind !== 'unknown')
            throw new SignalTreePublicationError(stage, 'malformed');
        const owners = [];
        if (kind === 'dependent') {
            const list = d.owners;
            if (!Array.isArray(list))
                throw new SignalTreePublicationError(stage, 'malformed');
            for (const handle of list) {
                const cell = handle && typeof handle === 'object' ? authentic.get(handle) : undefined;
                if (!cell || cell.outcome === 'rolled-back' || cell.outcome === 'abandoned')
                    throw new SignalTreePublicationError(stage, 'unavailable-owner');
                owners.push(cell);
            }
        }
        frame.declaredOwners = kind === 'unknown' ? undefined : Object.freeze([...new Set(owners)]);
        frame.owners = [...new Set([...frame.owners, ...owners])];
        frame.unknown = kind === 'unknown' || frame.ops.size > 0;
        stage = 'after-callback';
        let result;
        try {
            result = work();
        }
        catch (error) {
            thrown = true;
            primary = error;
        }
        if (isTraversableNode(result))
            if (typeof result.then === 'function')
                throw new SignalTreePublicationError(stage, 'async-callback');
        if (frameInvalid(frame))
            throw new SignalTreePublicationError(stage, 'contradiction');
        if (thrown)
            throw primary;
    }
    catch (error) {
        exitingError = true;
        for (const f of stack)
            f.invalid = true;
        if (thrown) {
            if (error !== primary && !reporting) {
                reporting = true;
                try {
                    c.report(error);
                }
                catch { }
                finally {
                    reporting = false;
                }
            }
            throw primary;
        }
        if (error instanceof SignalTreePublicationError)
            throw error;
        throw new SignalTreePublicationError(stage, 'validation-threw', { cause: error });
    }
    finally {
        stack.pop();
        h.open--;
        try {
            if (h.open === 0)
                finish(h);
        }
        catch (error) {
            if (!exitingError) {
                completionFailed = true;
                completionError = error;
            }
            else if (!reporting) {
                reporting = true;
                try {
                    c.report(error);
                }
                catch { }
                finally {
                    reporting = false;
                }
            }
        }
        finally {
            wake(channel);
        }
    }
    if (completionFailed)
        throw completionError;
    return receipt;
}
function makeReceipt(view) { return Object.freeze({ read: () => view.value }); }
export function diagnostics() { let cells = 0, operations = 0; for (const s of sources.values())
    cells += s.cells.size; for (const c of connections.values())
    operations += c.ops.size; return { sources: sources.size, pendingOwners: pending.size, ownerCells: cells, connections: connections.size, operations, activeFrames: stack.length }; }
export const unregisterOwnerSource = abandonOwnerSource;
export function isValidating() { return stack.length !== 0; }
export function completeDeclarationContext(channel) { return stack.some(f => f.channel === channel) && stack.every(f => f.declaredOwners !== undefined && !frameUnknown(f)); }
export function observeRevision(channel, revision, proof, projectionPending) {
    const c = connections.get(channel);
    if (!c || c.disposed)
        return;
    if (c.ops.has(revision))
        throw Error('Observed revision already registered');
    const op = { declared: false, recipientWindow: [], incomplete: false, projectionPending, coverageUnknown: false, channel, dependencies: new Set(), revision, frames: new Set(), views: new Set(), started: false, surviving: false, noopFallbacks: new Map(), proof };
    c.ops.set(revision, op);
    projectRevision(channel, revision, proof, projectionPending);
}
export function projectRevision(channel, revision, proof, projectionPending = false) {
    const op = connections.get(channel)?.ops.get(revision);
    if (!op)
        return proof;
    const selected = recipientProof(op, proof);
    op.projectionPending = projectionPending;
    op.proof = selected;
    for (const cell of [...selected.owners, ...(selected.possible ?? [])]) {
        op.dependencies.add(cell);
        cell.dependents.add(op);
    }
    refresh(op);
    return selected;
}
