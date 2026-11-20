// BRIEF.md section 11.4: exits 0 only when every item of section 9 (the
// definition of done) holds. Otherwise prints the next unmet item and the open
// needs-jonathan issues, and exits 1. Anything it cannot check counts as unmet.
//
// Conventions the rest of the repository follows so this check can see them:
// - Nightly workflow: .github/workflows/nightly.yml on main. Its jobs are named
//   `gates (<adapter>)` for plain (the core), angular, vue, solid, preact and
//   react, and `oracle (100k)`. This check reads the verdicts those jobs upload
//   (artifacts nightly-gates-<adapter> and nightly-oracle), not the jobs'
//   success: a results file that is record-only or unapproved counts as unmet.
// - Behavior coverage: a test title carries the behavior ID in brackets, e.g.
//   it('[T3] refuses with later-pending-dependency', ...).
// - Release docs (Phase 8): README.md, CHANGELOG.md, docs/migration/from-14.md,
//   from-15.md, from-16-rc.md, and a README.md in every package.
// - first production adopter validation: a closed issue labeled adopter-validated, closed by
//   Jonathan.
// - The new major's version number lives in ci/done-check.config.json.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkBoundaries } from './boundaries.mjs';
import { CORE_ONLY_APP, pluginFolderIdentity, scanApp } from './core-bundle-scan.mjs';
import { downloadArtifact, ghApi, repoSlug } from './github.mjs';
import { repoRoot } from './entry-graph.mjs';
import { validate as validateManifest } from './port-manifest.mjs';

export const OWNER_LOGIN = 'JBorgia';
export const ADAPTERS = ['plain', 'angular', 'vue', 'solid', 'preact', 'react'];
export const NIGHTLY_JOBS = [...ADAPTERS.map((a) => `gates (${a})`), 'oracle (100k)'];
/** Gates the harness runs (6.3 as amended by section 10). S6a and S6c are checked here by ci/core-bundle-scan.mjs. */
export const REQUIRED_GATES = ['M1', 'M2', 'M3', 'S1', 'S2', 'S3', 'S4a', 'S4b', 'S4c', 'S5', 'S6b', 'S7'];
export const ORACLE_MIN_RUNS = 100_000;
/** The generator's subject for the new core; old packages violating the spec are expected (12.1.4). */
export const ORACLE_SUBJECT = 'core';

/** Why one nightly run does not show every gate green, or null. Reads the uploaded verdicts, not job success. */
export function nightlyRunProblem(run) {
  if (run.conclusion !== 'success') return `nightly run ${run.id} concluded ${run.conclusion}`;
  for (const adapter of ADAPTERS) {
    const results = run.results?.[adapter];
    if (!results || results.error) return `nightly run ${run.id} has no gate results for ${adapter}${results?.error ? ` (${results.error})` : ''}`;
    if (results.budgets?.approved !== true) return `nightly run ${run.id} (${adapter}) ran against unapproved budgets`;
    if (results.recordOnly !== false) return `nightly run ${run.id} (${adapter}) was record-only`;
    for (const gate of REQUIRED_GATES) {
      const scenario = results.scenarios?.[gate];
      if (!scenario || scenario.status !== 'ran') return `nightly run ${run.id} (${adapter}): ${gate} ${scenario ? scenario.status : 'missing'}`;
      if (scenario.pass !== true) return `nightly run ${run.id} (${adapter}): ${gate} is not green`;
      if ((scenario.regressions ?? []).some((r) => r.regressed)) return `nightly run ${run.id} (${adapter}): ${gate} regressed`;
    }
  }
  const oracle = run.oracle;
  if (!oracle || oracle.error) return `nightly run ${run.id} has no oracle report${oracle?.error ? ` (${oracle.error})` : ''}`;
  if (!(oracle.runs >= ORACLE_MIN_RUNS)) return `nightly run ${run.id}: the oracle ran ${oracle.runs} sequences, fewer than ${ORACLE_MIN_RUNS}`;
  if (!(oracle.subjects ?? []).some((s) => s.name === ORACLE_SUBJECT)) return `nightly run ${run.id}: the generator did not run on the new core`;
  const violations = (oracle.violations ?? []).filter((v) => v.subject === ORACLE_SUBJECT).reduce((n, v) => n + (v.count ?? 1), 0);
  if (violations) return `nightly run ${run.id}: the new core violates the spec in ${violations} generated sequence(s)`;
  if (oracle.determinism && oracle.determinism.mismatches !== 0) return `nightly run ${run.id}: replays were not deterministic`;
  return null;
}
export const BEHAVIORS = [
  ...['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'],
  ...['R1', 'R2', 'R3', 'R4', 'E1', 'E2', 'L1', 'L2', 'L3', 'X1', 'X2'],
  ...['W1', 'W2', 'W3', 'W4'],
];
/** C1–C6 and the gates that prove them (BRIEF.md 4.2 and 6.3). */
export const COST_RULE_GATES = { C1: ['M1'], C2: ['S6'], C3: ['S6'], C4: ['S7'], C5: ['S5'], C6: ['M3'] };
export const RELEASE_DOCS = ['README.md', 'CHANGELOG.md', 'docs/migration/from-14.md', 'docs/migration/from-15.md', 'docs/migration/from-16-rc.md'];
/** Rule 9's internal process words; matched in prose, outside `code`. */
export const PROCESS_WORDS = [/\bHOLD\b/, /\breceipts?\b/i, /\bqualification\b/i, /\bowner instruction\b/i, /\bfalsifier\b/i];
const ARCHIVE = /\.(tar|tgz|zip|7z|gz|xz)$|\.part\d+$/i;
const SHORT_LIVED_DAYS = 7;

// ---------------------------------------------------------------- evaluation

/** Section 9, in order. Each check takes the gathered facts and returns null when it holds, or what is missing. */
export const ITEMS = [
  {
    title: 'Every gate in 6.3 is green for the core and every adapter on two consecutive nightly runs',
    check: ({ nightly, s6 }) => {
      if (nightly.error) return `could not read nightly runs: ${nightly.error}`;
      if (nightly.runs.length < 2) return `${nightly.runs.length} completed nightly run(s) on main; two consecutive green runs are needed`;
      for (const run of nightly.runs.slice(0, 2)) {
        const problem = nightlyRunProblem(run);
        if (problem) return problem;
      }
      if (s6.error) return `could not run the S6(a)/S6(c) scan: ${s6.error}`;
      return s6.findings.length ? `S6: ${s6.findings[0]}` : null;
    },
  },
  {
    title: 'Every behavior in 5.1 and 5.2 is covered by tests, and the test generator finds no spec violation by the new core at 100,000 sequences',
    check: ({ coveredBehaviors }) => {
      const missing = BEHAVIORS.filter((id) => !coveredBehaviors.has(id));
      return missing.length ? `no test title carries ${missing.map((id) => `[${id}]`).join(', ')}` : null;
    },
  },
  {
    title: 'tests/port-manifest.json has no pending entries and every internal entry is signed off',
    check: ({ manifestProblems }) => (manifestProblems.length ? `${manifestProblems.length} problem(s), first: ${manifestProblems[0]}` : null),
  },
  {
    title: 'C1–C6 are each proven by a gate',
    check: ({ budgetGates }) => {
      if (budgetGates.error) return `could not read bench/budgets.json: ${budgetGates.error}`;
      const missing = Object.entries(COST_RULE_GATES).filter(([, gates]) => !gates.every((g) => budgetGates.ids.has(g)));
      return missing.length ? `bench/budgets.json has no gate for ${missing.map(([c, g]) => `${c} (${g.join('+')})`).join(', ')}` : null;
    },
  },
  {
    title: 'No experimental, research, prototype or spike module is reachable from a public entry point',
    check: ({ rule7 }) => (rule7.length ? `${rule7.length} finding(s), first: ${rule7[0]}` : null),
  },
  {
    title: 'User docs, migration guides and the changelog exist and use no internal process language',
    check: ({ docs }) => {
      if (docs.missing.length) return `missing ${docs.missing.join(', ')}`;
      return docs.processWords.length ? `process language in ${docs.processWords[0]}` : null;
    },
  },
  {
    title: "Jonathan's validation with the first production adopter passes S1–S5 with real data on the slowest supported device",
    check: ({ adopter }) => {
      if (adopter.error) return `could not read issues: ${adopter.error}`;
      return adopter.validated ? null : `no closed issue labeled adopter-validated closed by ${OWNER_LOGIN}`;
    },
  },
  {
    title: 'One line of truth: main, release/15.x and tags; no long-lived branches; no evidence tarballs on main',
    check: ({ branches, mainTree }) => {
      if (branches.error) return `could not list branches: ${branches.error}`;
      if (mainTree.error) return `could not read main's tree: ${mainTree.error}`;
      const stale = branches.list.filter((b) => !['main', 'release/15.x'].includes(b.name) && b.ageDays > SHORT_LIVED_DAYS);
      if (stale.length) return `${stale.length} branch(es) older than ${SHORT_LIVED_DAYS} days, first: ${stale[0].name}`;
      const archives = mainTree.paths.filter((p) => ARCHIVE.test(p));
      return archives.length ? `archive in main's tree: ${archives[0]}` : null;
    },
  },
  {
    title: 'All of the above hold on a main release tag of the new major',
    check: ({ release }) => {
      if (release.error) return `could not read tags: ${release.error}`;
      if (release.major == null) return 'the new major\'s version number is not set in ci/done-check.config.json';
      return release.tagged ? null : `main's head carries no v${release.major}.x.y release tag`;
    },
  },
];

/** Evaluates every item; returns the unmet ones in section 9 order. */
export function evaluate(facts) {
  return ITEMS.map((item) => ({ title: item.title, missing: item.check(facts) })).filter((r) => r.missing !== null);
}

// ---------------------------------------------------------- fact gathering

/** Behavior IDs that appear in brackets in test titles. */
export function behaviorIdsIn(source) {
  const found = new Set();
  // it(...), it.only(...), describe.skip(...), and it.each(table)(...) forms.
  const title = /\b(?:it|test|describe)(?:\.(?:only|skip|concurrent|sequential|todo|fails))*(?:\.each\((?:[^()]|\([^()]*\))*\))?\(\s*(['"`])(.*?)\1/gs;
  for (const match of source.matchAll(title)) {
    for (const id of match[2].matchAll(/\[(T10|T[1-9]|R[1-4]|E[12]|L[1-3]|X[12]|W[1-4])\]/g)) found.add(id[1]);
  }
  return found;
}

/** Prose lines (outside fenced and inline code) that use a rule 9 process word. */
export function processWordsIn(markdown) {
  const hits = [];
  let fenced = false;
  for (const [i, line] of markdown.split('\n').entries()) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const prose = line.replace(/`[^`]*`/g, '');
    if (PROCESS_WORDS.some((w) => w.test(prose))) hits.push(i + 1);
  }
  return hits;
}

/** All IDs that look like gate IDs anywhere in budgets.json (keys or "id"/"gate" values). */
export function gateIdsIn(budgets) {
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        const key = k.match(/^(M[1-3]|S[1-7]|Q1)[a-c]?$/);
        if (key) ids.add(key[1]);
        if ((k === 'id' || k === 'gate') && typeof v === 'string') {
          const m = v.match(/^(M[1-3]|S[1-7]|Q1)[a-c]?$/);
          if (m) ids.add(m[1]);
        }
        visit(v);
      }
    }
  };
  visit(budgets);
  return ids;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Downloads a run's artifact by name and parses the newest JSON file matching `pattern` in it. */
function artifactJson(repo, artifacts, name, pattern) {
  const artifact = artifacts.find((a) => a.name === name && !a.expired);
  if (!artifact) return { error: `artifact ${name} missing` };
  const dir = mkdtempSync(join(tmpdir(), 'signal-tree-done-'));
  try {
    downloadArtifact(repo, artifact.id, dir);
    const file = walk(dir).filter((f) => pattern.test(f.split('/').pop())).sort().pop();
    return file ? JSON.parse(readFileSync(file, 'utf8')) : { error: `no ${pattern} in ${name}` };
  } catch (error) {
    return { error: String(error.message ?? error).split('\n')[0] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function attempt(fn) {
  try {
    return fn();
  } catch (error) {
    return { error: String(error.message ?? error).split('\n')[0] };
  }
}

export async function gatherFacts(root = repoRoot, now = Date.now()) {
  const slug = attempt(() => repoSlug(root));
  const repo = slug.error ? null : slug;
  const needRepo = () => {
    if (!repo) throw new Error(`no GitHub repository: ${slug.error}`);
    return repo;
  };

  const nightly = attempt(() => {
    const runs = ghApi(`repos/${needRepo()}/actions/workflows/nightly.yml/runs?branch=main&status=completed&per_page=10`)
      .flatMap((page) => page.workflow_runs ?? [])
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 2);
    return {
      runs: runs.map((run) => {
        const artifacts = ghApi(`repos/${needRepo()}/actions/runs/${run.id}/artifacts?per_page=100`).flatMap((p) => p.artifacts ?? []);
        return {
          id: run.id,
          conclusion: run.conclusion,
          results: Object.fromEntries(ADAPTERS.map((a) => [a, artifactJson(needRepo(), artifacts, `nightly-gates-${a}`, /^results-.+-latest\.json$/)])),
          oracle: artifactJson(needRepo(), artifacts, 'nightly-oracle', /^spec-report\.json$/),
        };
      }),
    };
  });

  const s6 = await (async () => {
    try {
      const scan = await scanApp(CORE_ONLY_APP, { root });
      const identity = await pluginFolderIdentity({ coreDir: join(root, 'packages', 'core') });
      return {
        findings: [
          ...scan.pluginInputs.map((f) => `plugin source in the core-only bundle: ${f}`),
          ...scan.pluginSymbols.map(([name, plugin]) => `${plugin} symbol ${name} in the core-only bundle`),
          ...scan.benchLeaks.map((n) => `bench-only ${n} in the production bundle`),
          ...identity.differences,
        ],
      };
    } catch (error) {
      return { error: String(error.message ?? error).split('\n')[0] };
    }
  })();

  const coveredBehaviors = new Set();
  for (const file of [...walk(join(root, 'packages')), ...walk(join(root, 'tests'))].filter((f) => /\.(spec|test|prop)\.ts$/.test(f))) {
    for (const id of behaviorIdsIn(readFileSync(file, 'utf8'))) coveredBehaviors.add(id);
  }

  const manifestPath = join(root, 'tests', 'port-manifest.json');
  const manifestProblems = existsSync(manifestPath)
    ? validateManifest(JSON.parse(readFileSync(manifestPath, 'utf8')), { complete: true, fileExists: (p) => existsSync(join(root, p)) })
    : ['tests/port-manifest.json is missing'];

  const budgetsPath = join(root, 'bench', 'budgets.json');
  const budgetGates = existsSync(budgetsPath)
    ? attempt(() => ({ ids: gateIdsIn(JSON.parse(readFileSync(budgetsPath, 'utf8'))) }))
    : { error: 'file missing' };

  const rule7 = (await checkBoundaries({ root })).flatMap((r) => r.problems.filter((p) => p.startsWith('rule 7')).map((p) => `${r.entry.specifier}: ${p}`));

  const packageReadmes = readdirSync(join(root, 'packages')).map((d) => `packages/${d}/README.md`);
  const docFiles = [...RELEASE_DOCS, ...packageReadmes];
  const docs = { missing: docFiles.filter((p) => !existsSync(join(root, p))), processWords: [] };
  for (const p of docFiles.filter((f) => existsSync(join(root, f))).concat(walk(join(root, 'docs')).map((f) => relative(root, f)).filter((f) => f.endsWith('.md')))) {
    for (const line of processWordsIn(readFileSync(join(root, p), 'utf8'))) docs.processWords.push(`${p}:${line}`);
  }

  const adopter = attempt(() => {
    const issues = ghApi(`repos/${needRepo()}/issues?labels=adopter-validated&state=closed&per_page=100`).flatMap((p) => (Array.isArray(p) ? p : [p]));
    const validated = issues.some((i) => {
      const detail = ghApi(`repos/${needRepo()}/issues/${i.number}`)[0] ?? {};
      return detail.closed_by?.login === OWNER_LOGIN;
    });
    return { validated };
  });

  const branches = attempt(() => ({
    list: ghApi(`repos/${needRepo()}/branches?per_page=100`)
      .flat()
      .map((b) => {
        const commit = ghApi(`repos/${needRepo()}/commits/${b.commit.sha}`)[0];
        return { name: b.name, ageDays: (now - Date.parse(commit.commit.committer.date)) / 86_400_000 };
      }),
  }));

  const mainTree = attempt(() => ({
    paths: ghApi(`repos/${needRepo()}/git/trees/main?recursive=1`).flatMap((p) => p.tree ?? []).filter((t) => t.type === 'blob').map((t) => t.path),
  }));

  const release = attempt(() => {
    const configPath = join(root, 'ci', 'done-check.config.json');
    const major = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')).releaseMajor ?? null : null;
    if (major == null) return { major: null };
    const mainSha = ghApi(`repos/${needRepo()}/commits/main`)[0].sha;
    const tags = ghApi(`repos/${needRepo()}/tags?per_page=100`).flat();
    const pattern = new RegExp(`^v${major}\\.\\d+\\.\\d+$`);
    return { major, tagged: tags.some((t) => pattern.test(t.name) && t.commit.sha === mainSha) };
  });

  const openQuestions = attempt(() => ({
    list: ghApi(`repos/${needRepo()}/issues?labels=needs-jonathan&state=open&per_page=100`)
      .flat()
      .filter((i) => !i.pull_request)
      .map((i) => `#${i.number} ${i.title}`),
  }));

  return { nightly, s6, coveredBehaviors, manifestProblems, budgetGates, rule7, docs, adopter, branches, mainTree, release, openQuestions };
}

// -------------------------------------------------------------------- main

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const facts = await gatherFacts();
  const unmet = evaluate(facts);
  if (unmet.length === 0) {
    console.log('Done: every item in BRIEF.md section 9 holds.');
    process.exit(0);
  }
  const [next] = unmet;
  console.log(`Not done: ${unmet.length} of ${ITEMS.length} items in BRIEF.md section 9 are unmet.`);
  console.log(`Next unmet item: ${next.title}`);
  console.log(`  ${next.missing}`);
  if (facts.openQuestions.error) console.log(`Open needs-jonathan issues: could not read them (${facts.openQuestions.error})`);
  else if (facts.openQuestions.list.length === 0) console.log('Open needs-jonathan issues: none');
  else console.log(`Open needs-jonathan issues:\n${facts.openQuestions.list.map((q) => `  ${q}`).join('\n')}`);
  process.exit(1);
}
