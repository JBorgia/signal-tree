#!/usr/bin/env node
/**
 * Mechanical discovery of every first-party TypeScript project in the
 * workspace, with each project's OWN tsconfig.
 *
 *     THE COMPILATION UNIT CHOOSES THE ANALYSIS UNIVERSE; THE DIRECTORY DOES
 *     NOT.
 *     A ZERO-CONSUMER CLAIM IS ONLY AS LARGE AS THE CONSUMER UNIVERSE IT
 *     SEARCHED.
 *
 * ⚠️ A HAND-WRITTEN ROOTS LIST IS THE SAME DEFECT IN ANOTHER FORM. The first
 * consumer trace searched `core`, `shared` and `demo` because I typed those
 * three, and reported "zero elsewhere" — a claim about the whole workspace
 * derived from a list nobody had checked. Stale path mappings have also pointed
 * at deleted packages, so filesystem discovery and alias validation remain
 * independent requirements.
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Project roots: any directory holding a `project.json`. */
export function discoverProjectRoots(root = ROOT) {
  const out = [];
  for (const container of ['packages', 'apps']) {
    const base = join(root, container);
    if (!existsSync(base)) continue;
    for (const e of readdirSync(base)) {
      const dir = join(base, e);
      if (!statSync(dir).isDirectory()) continue;
      if (existsSync(join(dir, 'project.json'))) out.push(dir);
    }
  }
  return out.sort();
}

/** Buildable TS configs for a project root, most specific first. */
const CONFIG_CANDIDATES = [
  'tsconfig.lib.json',
  'tsconfig.app.json',
  'tsconfig.json',
];

export function discoverProjects(root = ROOT) {
  const projects = [];
  for (const dir of discoverProjectRoots(root)) {
    const cfgName = CONFIG_CANDIDATES.find((c) => existsSync(join(dir, c)));
    if (!cfgName) {
      projects.push({
        dir,
        config: null,
        fileNames: [],
        options: null,
        note: 'no tsconfig',
      });
      continue;
    }
    const configPath = join(dir, cfgName);
    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (read.error) {
      projects.push({
        dir,
        config: configPath,
        fileNames: [],
        options: null,
        note: 'unreadable',
      });
      continue;
    }
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dir);
    projects.push({
      dir,
      name: relative(root, dir),
      config: relative(root, configPath),
      fileNames: parsed.fileNames.filter((f) => f.endsWith('.ts')),
      options: parsed.options,
      note: null,
    });
  }
  return projects;
}

/**
 * Path mappings that point at files which do not exist. Not fatal for the
 * consumer trace, but a dangling first-party mapping means an import that
 * SHOULD resolve silently would not.
 */
export function danglingPathMappings(root = ROOT) {
  const configPath = join(root, 'tsconfig.base.json');
  if (!existsSync(configPath)) return [];
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, root);
  const paths = parsed.options?.paths ?? {};
  const bad = [];
  for (const [spec, targets] of Object.entries(paths))
    for (const t of targets)
      if (!t.includes('*') && !existsSync(join(root, t)))
        bad.push({ spec, target: t });
  return bad;
}

/**
 * The Nx project graph's own answer, for parity.
 *
 *     THE WORKSPACE GRAPH CHOOSES THE PROJECT UNIVERSE; A `project.json`
 *     FILESYSTEM CONVENTION DOES NOT.
 *
 * ⚠️ THE CONVENTION MISSED ONE. "Immediate child of packages/ or apps/ holding a
 * project.json" is mechanical but invented by this audit, and Nx reports FIVE
 * projects — including `@signaltree/source`, the workspace ROOT project. That
 * root carries no `sourceRoot`, but the tree it sits on holds 1,162 TypeScript
 * files under `scripts/` alone, none of which any discovered project compiles.
 */
export function nxProjectNames(root = ROOT) {
  try {
    const out = execSync('npx nx show projects', {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const trimmed = out.trim();
    return trimmed.startsWith('[')
      ? JSON.parse(trimmed)
      : trimmed
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
  } catch {
    return null; // reported as unavailable, never silently treated as agreement
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const projects = discoverProjects();
  console.log(`first-party projects: ${projects.length}`);
  for (const p of projects)
    console.log(
      `  ${(p.name ?? p.dir).padEnd(20)} ${String(p.config ?? p.note).padEnd(
        28
      )} ${p.fileNames.length} .ts inputs`
    );
  const nx = nxProjectNames();
  if (nx === null)
    console.log('\n⚠️  Nx project graph unavailable — parity UNVERIFIED');
  else {
    // Nx names are short (`core`); ours are paths (`packages/kernel`).
    const short = new Set(projects.map((p) => (p.name ?? '').split('/').pop()));
    const nxOnly = nx.filter((n) => !short.has(n.split('/').pop()));
    console.log(`\nNx reports ${nx.length} project(s): ${JSON.stringify(nx)}`);
    if (nxOnly.length)
      console.log(
        `  ⚠️  ${nxOnly.length} Nx project(s) NOT matched by filesystem discovery: ` +
          `${JSON.stringify(nxOnly)}\n` +
          '      Their sources are outside every discovered project tsconfig, so a\n' +
          '      symbol-resolved scan cannot see them. The claimant sweep covers this\n' +
          '      by scanning every first-party .ts on disk, not project inputs.'
      );
    else console.log('  ✅ filesystem discovery matches the Nx project set');
  }

  const dangling = danglingPathMappings();
  console.log(`\ndangling path mappings: ${dangling.length}`);
  for (const d of dangling) console.log(`  ${d.spec} -> ${d.target}`);
}
