// Gate-host preflight (#18, Jonathan's gate conditions). On the dedicated gate
// runner, a gate run is recorded or judged only when:
//   - every core's CPU frequency governor is `performance`, and
//   - no swap is in use (no active swap device, or SwapTotal == SwapFree).
// It also records the boost/turbo setting, so A/A noise is read with it.
// Off the gate runner (RUNNER_ENVIRONMENT !== 'self-hosted') it only reports:
// hosted runners don't expose a fixed governor, and their timings are never
// compared (ci/gate-baseline.mjs).
//
//   node ci/gate-host.mjs [--out bench/out/gate-host.json]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8').trim() : null);

/** What the host reports, read under `root` (a fake tree in tests). */
export function readHost(root = '/') {
  const cpuDir = join(root, 'sys/devices/system/cpu');
  const cpus = existsSync(cpuDir) ? readdirSync(cpuDir).filter((d) => /^cpu\d+$/.test(d)) : [];
  const governors = cpus.map((cpu) => read(join(cpuDir, cpu, 'cpufreq/scaling_governor')));
  const swapsText = read(join(root, 'proc/swaps')) ?? '';
  const swapDevices = swapsText.split('\n').slice(1).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/)[0]);
  const meminfo = read(join(root, 'proc/meminfo')) ?? '';
  const kb = (key) => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? NaN);
  const boost = read(join(cpuDir, 'cpufreq/boost'));
  const noTurbo = read(join(cpuDir, 'intel_pstate/no_turbo'));
  return {
    cpus: cpus.length,
    governors,
    swapDevices,
    swapTotalKb: kb('SwapTotal'),
    swapFreeKb: kb('SwapFree'),
    boost: boost !== null ? (boost === '1' ? 'on' : 'off') : noTurbo !== null ? (noTurbo === '1' ? 'off' : 'on') : 'unknown',
  };
}

/** Why this host must not run gates; empty when it may. */
export function hostProblems(host) {
  const problems = [];
  if (host.cpus === 0 || host.governors.length === 0) problems.push('no CPUs found under /sys/devices/system/cpu');
  const unreadable = host.governors.filter((g) => g === null).length;
  if (unreadable) problems.push(`the frequency governor can't be read on ${unreadable} of ${host.governors.length} CPU(s)`);
  const off = host.governors.filter((g) => g !== null && g !== 'performance');
  if (off.length) problems.push(`${off.length} CPU(s) are not on the performance governor (${[...new Set(off)].join(', ')})`);
  if (!Number.isFinite(host.swapTotalKb) || !Number.isFinite(host.swapFreeKb)) problems.push('swap use can\'t be read from /proc/meminfo');
  else if (host.swapTotalKb - host.swapFreeKb > 0) problems.push(`${host.swapTotalKb - host.swapFreeKb} kB of swap is in use`);
  if (host.swapDevices.length) problems.push(`swap is enabled (${host.swapDevices.join(', ')}); run swapoff -a and remove it from /etc/fstab`);
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outIndex = process.argv.indexOf('--out');
  const out = outIndex > 0 ? process.argv[outIndex + 1] : undefined;
  const onGateRunner = process.env.RUNNER_ENVIRONMENT === 'self-hosted';
  const host = readHost();
  const problems = onGateRunner ? hostProblems(host) : [];
  const record = { onGateRunner, ...host, governors: [...new Set(host.governors)], problems };
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  }
  console.log(`gate host: ${host.cpus} CPU(s), governor ${record.governors.join('/') || 'unknown'}, boost ${host.boost}, swap ${host.swapDevices.length ? host.swapDevices.join(', ') : 'off'}`);
  if (!onGateRunner) {
    console.log('not on the gate runner: reported only');
    process.exit(0);
  }
  for (const p of problems) console.log(`FAIL ${p}`);
  if (problems.length) {
    console.log('This gate runner must not record or judge gates until fixed (#18).');
    process.exit(1);
  }
  console.log('ok: the gate runner may record and judge gates');
}
