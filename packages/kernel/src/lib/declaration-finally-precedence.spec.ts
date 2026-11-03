import { expect, it, vi } from 'vitest';

const cases = [
  'success', 'primary-object', 'primary-string', 'primary-undefined',
  'finish-object', 'finish-undefined', 'primary-and-finish',
  'undefined-primary-and-finish', 'reporter-throws', 'validation-getter',
  'finish-reentry', 'finish-reentry-throws', 'wake-success', 'wake-primary',
  'wake-finish', 'queued-wake-reentry',
] as const;

it.each(cases)('declaration precedence: %s', async (name) => {
  vi.resetModules();
  const life = await import('./experimental-publication/lifecycle');
  const { installTerminalRecord } = await import('./internals/intrinsic-mutation');
  const primary = { role: 'primary' }, completion = { role: 'completion' };
  const reporter = { role: 'reporter' }, waking = { role: 'wake' }, validation = { role: 'validation' };
  const queue: VoidFunction[] = [], reports: unknown[] = [], trace: string[] = [];
  const channel = {};
  const wakeFails = name.startsWith('wake-');
  let failSchedule = wakeFails, nested = 0;
  vi.stubGlobal('queueMicrotask', (callback: VoidFunction) => {
    queue.push(callback);
    if (failSchedule) { failSchedule = false; throw waking; }
  });
  life.registerConnection(channel, {
    supported: true,
    report(error) { reports.push(error); if (name === 'reporter-throws') throw reporter; },
    wake() {
      trace.push('wake'); expect(life.diagnostics().activeFrames).toBe(0);
      if (name === 'queued-wake-reentry' && nested++ === 0) {
        expect(life.runDeclaration(channel, { kind: 'independent' }, () => undefined).read()).toEqual({ state: 'no-write' });
      }
    },
  });
  const hasPrimary = name.startsWith('primary-') || name === 'undefined-primary-and-finish' || name === 'reporter-throws' || name === 'wake-primary';
  const primaryValue = name.includes('undefined') && hasPrimary ? undefined : name === 'primary-string' ? 'primitive-primary' : primary;
  const hasFinish = name.includes('finish') || name === 'reporter-throws';
  const finishValue = name === 'finish-undefined' ? undefined : completion;
  const observerThrows = hasFinish && name !== 'finish-reentry';
  let didThrow = false, caught: unknown, receipt: ReturnType<typeof life.runDeclaration> | undefined;
  try {
    const input = name === 'validation-getter' ? { get kind(): string { throw validation; } } : { kind: 'independent' };
    try {
      receipt = life.runDeclaration(channel, input, () => {
        trace.push('callback');
        if (hasFinish) {
          const prepared = life.prepareNativeRequirement([], false, []);
          installTerminalRecord(prepared.record);
          life.finalizeNativeRequirement(prepared.requirement);
          life.onNativeRequirementReady(prepared.requirement, () => {
            trace.push('observer'); expect(life.diagnostics().activeFrames).toBe(0);
            if (name.startsWith('finish-reentry')) {
              expect(life.runDeclaration(channel, { kind: 'independent' }, () => undefined).read()).toEqual({ state: 'no-write' });
              trace.push('nested-complete');
            }
            if (observerThrows) throw finishValue;
          });
          life.onNativeRequirementReady(prepared.requirement, () => { trace.push('second-observer'); });
          life.deliverNativeRequirementReady(prepared.requirement);
        }
        if (hasPrimary) throw primaryValue;
      });
    } catch (error) { didThrow = true; caught = error; }
    expect(life.diagnostics().activeFrames).toBe(0);
    const expectsThrow = wakeFails || hasPrimary || observerThrows || name === 'validation-getter';
    expect(didThrow).toBe(expectsThrow);
    if (wakeFails) expect(caught).toBe(waking);
    else if (hasPrimary) expect(caught).toBe(primaryValue);
    else if (observerThrows) expect(caught).toBe(finishValue);
    else if (name === 'validation-getter') expect(caught).toMatchObject({ reason: 'validation-threw', cause: validation });
    else expect(receipt?.read()).toEqual({ state: 'no-write' });
    expect(reports).toEqual(hasPrimary && observerThrows ? [finishValue] : []);
    if (hasFinish) expect(trace.filter(x => x.endsWith('observer'))).toEqual(['observer', 'second-observer']);
    if (name.startsWith('finish-reentry')) expect(trace).toContain('nested-complete');
    // Drain the captured host queue after observing synchronous precedence.
    let turns = 0;
    while (queue.length) { expect(++turns).toBeLessThan(5); queue.shift()?.(); }
    expect(trace).toContain('wake');
    expect(life.diagnostics().activeFrames).toBe(0);
    // Subsequent declaration also witnesses restored stack/reporting state.
    expect(life.runDeclaration(channel, { kind: 'independent' }, () => undefined).read()).toEqual({ state: 'no-write' });
  } finally {
    life.disposeConnection(channel);
    while (queue.length) queue.shift()?.();
    vi.unstubAllGlobals();
  }
});
