import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** Installed version of node_modules/<specifier>, plus the real path (pnpm symlinks resolved). */
export function installed(appRoot, specifier) {
  const dir = join(appRoot, 'node_modules', specifier);
  const pkg = readJson(join(dir, 'package.json'));
  if (!pkg) return null;
  return {
    specifier,
    name: pkg.name,
    version: pkg.version,
    realPath: realpathSync(dir),
  };
}

/** Resolve `name` the way Node would from inside `fromDir` (nested node_modules, or a pnpm sibling). */
export function resolveFrom(fromDir, name) {
  let d = fromDir;
  for (;;) {
    for (const c of [join(d, 'node_modules', name), join(d, name)]) {
      const pkg = readJson(join(c, 'package.json'));
      if (pkg && pkg.name === name)
        return { name, version: pkg.version, realPath: realpathSync(c) };
    }
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

const git = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

export function collectEnvironment({
  appRoot,
  cpu,
  customRoot,
  candidateSelected,
}) {
  const libs = {};
  for (const spec of ['@ngrx/signals', '@signaltree/core', '@angular/core'])
    libs[spec] = installed(appRoot, spec);
  for (const spec of ['st15-released', 'st15-candidate']) {
    const pkg = installed(appRoot, spec);
    libs[spec] = pkg && {
      ...pkg,
      kernel: resolveFrom(pkg.realPath, '@signal-tree/kernel'),
    };
  }
  const candidateFile = join(
    appRoot,
    'node_modules',
    'st15-candidate',
    '.candidate.json'
  );
  const cores = os.cpus().length;
  const load = os.loadavg()[0];
  const status = git(appRoot, ['status', '--porcelain', '--', '.']);
  return {
    libraries: libs,
    candidate: existsSync(candidateFile) ? readJson(candidateFile) : null,
    candidateSelected,
    customRoot,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.platform()}/${os.arch()})`,
    cpu: { model: os.cpus()[0]?.model ?? 'unknown', cores },
    throttle: cpu ?? 'none',
    git: {
      sha: git(appRoot, ['rev-parse', '--short', 'HEAD']),
      dirty: status === null ? null : status.length > 0,
    },
    loadAverage1m: load,
    busy: load > cores / 2,
    chromium: null, // filled by the runner after launch
  };
}
