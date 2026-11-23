import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hostProblems, readHost } from './gate-host.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));

function fakeHost({ governors, swaps = [], swapTotal = 0, swapFree = 0, boost }: { governors: (string | null)[]; swaps?: string[]; swapTotal?: number; swapFree?: number; boost?: string }) {
  const root = mkdtempSync(join(tmpdir(), 'gate-host-'));
  roots.push(root);
  governors.forEach((g, i) => {
    const dir = join(root, 'sys/devices/system/cpu', `cpu${i}`, 'cpufreq');
    mkdirSync(dir, { recursive: true });
    if (g !== null) writeFileSync(join(dir, 'scaling_governor'), `${g}\n`);
  });
  if (boost !== undefined) {
    mkdirSync(join(root, 'sys/devices/system/cpu/cpufreq'), { recursive: true });
    writeFileSync(join(root, 'sys/devices/system/cpu/cpufreq/boost'), boost);
  }
  mkdirSync(join(root, 'proc'), { recursive: true });
  writeFileSync(join(root, 'proc/swaps'), ['Filename Type Size Used Priority', ...swaps].join('\n'));
  writeFileSync(join(root, 'proc/meminfo'), `MemTotal: 65000000 kB\nSwapTotal: ${swapTotal} kB\nSwapFree: ${swapFree} kB\n`);
  return root;
}

describe('gate-host preflight (#18)', () => {
  it('passes a host with every core on performance and no swap, and records boost', () => {
    const host = readHost(fakeHost({ governors: ['performance', 'performance'], boost: '0' }));
    expect(hostProblems(host)).toEqual([]);
    expect(host.boost).toBe('off');
  });

  it('fails when any core is not on the performance governor', () => {
    const problems = hostProblems(readHost(fakeHost({ governors: ['performance', 'schedutil'] })));
    expect(problems).toEqual([expect.stringContaining('1 CPU(s) are not on the performance governor (schedutil)')]);
  });

  it('fails closed when a governor cannot be read (no cpufreq, as on many VMs)', () => {
    expect(hostProblems(readHost(fakeHost({ governors: [null, null] })))).toEqual([expect.stringContaining("can't be read on 2 of 2")]);
  });

  it('fails when swap is enabled, and when swap is in use', () => {
    const enabled = hostProblems(readHost(fakeHost({ governors: ['performance'], swaps: ['/swapfile file 2097148 0 -2'], swapTotal: 2097148, swapFree: 2097148 })));
    expect(enabled).toEqual([expect.stringContaining('swap is enabled (/swapfile)')]);
    const used = hostProblems(readHost(fakeHost({ governors: ['performance'], swaps: ['/swapfile file 2097148 512 -2'], swapTotal: 2097148, swapFree: 2096636 })));
    expect(used).toEqual(expect.arrayContaining([expect.stringContaining('512 kB of swap is in use')]));
  });

  it('fails when no CPUs are visible', () => {
    expect(hostProblems(readHost(fakeHost({ governors: [] })))).toEqual([expect.stringContaining('no CPUs found')]);
  });
});
