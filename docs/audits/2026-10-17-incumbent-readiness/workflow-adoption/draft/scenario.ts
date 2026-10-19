import assert from 'node:assert/strict';
import { TicketEditor, type Ticket } from './editor';

function deferred<T>() {
  let complete!: (value: T) => void;
  const promise = new Promise<T>(resolve => { complete = resolve; });
  return { promise, complete };
}
export async function run() {
  const sent: Ticket[] = [];
  const initial: Ticket = { id: 'T-42', title: 'Repair scale', assignee: 'Ada', status: 'open' };
  const editor = new TicketEditor(initial, async ticket => {
    await Promise.resolve();
    sent.push(structuredClone(ticket));
  });
  const outcomes: string[] = [];
  try {
    editor.open();
    editor.edit('title', 'Calibrate scale');
    editor.edit('assignee', 'Grace');
    assert.deepEqual(editor.live(), initial);
    await editor.settled();
    assert.equal(sent.length, 0);
    editor.liveEdit('status', 'triaged');
    await editor.settled();
    assert.deepEqual(sent, [{ ...initial, status: 'triaged' }]);
    const isolated = editor.draft(); isolated.title = 'mutated copy';
    assert.equal(editor.draft().title, 'Calibrate scale');
    const review = editor.review();
    assert.deepEqual(review, { ticket: { ...initial, title: 'Calibrate scale', assignee: 'Grace', status: 'triaged' }, conflicts: [] });
    review.ticket.title = 'mutated review';
    editor.accept();
    await editor.settled();
    assert.deepEqual(sent, [{ ...initial, status: 'triaged' }, { ...initial, title: 'Calibrate scale', assignee: 'Grace', status: 'triaged' }]);
    outcomes.push('isolated draft; live progress; coherent accepted pair; copies do not mutate authority');

    editor.open(); editor.edit('title', 'User title');
    editor.liveEdit('title', 'Concurrent title'); await editor.settled();
    const beforeConflict = sent.length;
    assert.deepEqual(editor.review().conflicts, [{ field: 'title', base: 'Calibrate scale', live: 'Concurrent title', draft: 'User title' }]);
    assert.throws(() => editor.accept(), /resolve conflicts/);
    await editor.settled(); assert.equal(sent.length, beforeConflict);
    editor.resolve('title', 'draft');
    assert.throws(() => editor.accept(), /review required/);
    assert.deepEqual(editor.review().conflicts, []);
    editor.accept(); await editor.settled();
    assert.equal(sent.length, beforeConflict + 1); assert.equal(sent.at(-1)?.title, 'User title');
    outcomes.push('overlap blocked; explicit draft choice; fresh review accepted');

    editor.open(); editor.edit('title', 'Rejected conflict');
    editor.liveEdit('title', 'Live wins'); await editor.settled();
    assert.equal(editor.review().conflicts.length, 1);
    editor.resolve('title', 'live');
    assert.equal(editor.draft().title, 'Live wins');
    assert.equal(editor.review().ticket.title, 'Live wins');
    const beforeLiveChoice = sent.length;
    editor.accept(); await editor.settled();
    assert.equal(sent.length, beforeLiveChoice);
    editor.open(); editor.edit('assignee', 'Discarded assignee');
    editor.reject(); await editor.settled(); assert.equal(sent.length, beforeLiveChoice);
    assert.equal(editor.live().assignee, 'Grace');
    editor.liveEdit('status', 'working'); await editor.settled();
    assert.equal(sent.length, beforeLiveChoice + 1); assert.equal(sent.at(-1)?.status, 'working');
    outcomes.push('explicit live choice; rejection has no publication; ongoing live synchronization');

    editor.open(); editor.edit('assignee', 'Lin'); editor.review();
    editor.liveEdit('status', 'blocked'); await editor.settled();
    assert.throws(() => editor.accept(), /review required/);
    assert.equal(editor.live().assignee, 'Grace');
    assert.equal(editor.review().ticket.status, 'blocked');
    editor.accept(); await editor.settled();
    assert.deepEqual(sent.at(-1), { id: 'T-42', title: 'Live wins', assignee: 'Lin', status: 'blocked' });
    outcomes.push('stale review blocked; fresh review preserves disjoint change');

    editor.open(); editor.edit('title', 'Reviewed title'); editor.review();
    editor.liveEdit('title', 'Overlap after review'); await editor.settled();
    const beforeLateOverlap = sent.length;
    assert.throws(() => editor.accept(), /review required/);
    assert.equal(editor.live().title, 'Overlap after review');
    assert.equal(editor.review().conflicts.length, 1);
    assert.throws(() => editor.accept(), /resolve conflicts/);
    editor.reject(); await editor.settled(); assert.equal(sent.length, beforeLateOverlap);
    editor.liveEdit('title', 'Live wins'); await editor.settled();
    editor.open(); editor.edit('assignee', 'ABA candidate'); editor.review();
    editor.liveEdit('status', 'temporary'); editor.liveEdit('status', 'blocked'); await editor.settled();
    assert.throws(() => editor.accept(), /review required/);
    editor.reject();
    outcomes.push('late overlapping change blocks stale accept; live ABA also requires fresh review');

    editor.open(); const old = deferred<string>(); const oldResult = editor.suggestTitle(old.promise);
    editor.reject(); editor.open(); old.complete('obsolete session');
    assert.equal(await oldResult, 'stale'); assert.equal(editor.draft().title, 'Live wins');
    const overwritten = deferred<string>(); const overwrittenResult = editor.suggestTitle(overwritten.promise);
    editor.edit('title', 'Manual latest'); overwritten.complete('obsolete edit');
    assert.equal(await overwrittenResult, 'stale'); assert.equal(editor.draft().title, 'Manual latest');
    const beforeSuggestion = sent.length;
    assert.equal(await editor.suggestTitle(Promise.resolve('Fresh suggestion')), 'applied');
    assert.equal(editor.draft().title, 'Fresh suggestion'); await editor.settled();
    assert.equal(sent.length, beforeSuggestion); editor.reject();
    outcomes.push('stale session and edit completions dropped; current completion stays draft-local');

    editor.open(); editor.edit('title', 'Equal choice');
    editor.liveEdit('title', 'Equal choice'); await editor.settled();
    assert.deepEqual(editor.review().conflicts, []);
    editor.accept(); await editor.settled();
    editor.open(); editor.edit('assignee', 'Margaret');
    editor.liveEdit('title', 'Untouched title advances'); await editor.settled();
    assert.equal(editor.review().ticket.title, 'Untouched title advances');
    editor.accept(); await editor.settled();
    assert.equal(sent.at(-1)?.title, 'Untouched title advances');
    assert.equal(sent.at(-1)?.assignee, 'Margaret');
    outcomes.push('equal concurrent edit accepted; untouched field preserves live');

    editor.open(); const disposed = deferred<string>(); const disposedResult = editor.suggestTitle(disposed.promise);
    const beforeDestroy = sent.length;
    editor.destroy(); editor.destroy(); disposed.complete('after destruction');
    assert.equal(await disposedResult, 'stale');
    assert.throws(() => editor.open(), /destroyed/);
    assert.throws(() => editor.liveEdit('status', 'after destruction'), /destroyed/);
    await editor.settled(); assert.equal(sent.length, beforeDestroy);
    outcomes.push('idempotent teardown; stale completion and new mutations blocked');
    return { outcomes, endpointDeliveries: sent.length, sent };
  } finally { editor.destroy(); }
}
