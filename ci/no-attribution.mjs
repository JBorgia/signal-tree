// Required PR check: fails when any commit in the pull request, or the pull
// request's description, carries tool attribution (see ci/attribution.mjs).
//
//   node ci/no-attribution.mjs --base <sha> --head <sha> [--body-file <path>]
//
// In GitHub Actions the description is read from the pull_request event
// payload ($GITHUB_EVENT_PATH) when --body-file is not given.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findAttribution } from './attribution.mjs';

/** Commits in base..head with their full messages. */
export function commitsBetween(base, head, cwd = process.cwd()) {
  const out = execFileSync('git', ['log', '--format=%H%x00%B%x01', `${base}..${head}`], { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
  return out
    .split('\x01')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.includes('\x00'))
    .map((record) => {
      const [sha, message] = record.split('\x00');
      return { sha, message };
    });
}

/** Problems for the given commits and description; empty means the check passes. */
export function attributionProblems(commits, body) {
  const problems = [];
  for (const { sha, message } of commits) {
    for (const f of findAttribution(message)) problems.push(`commit ${sha.slice(0, 9)} line ${f.line} (${f.name}): ${f.text}`);
  }
  for (const f of findAttribution(body)) problems.push(`pull request description line ${f.line} (${f.name}): ${f.text}`);
  return problems;
}

function option(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = option('--base');
  const head = option('--head');
  if (!base || !head) {
    console.error('usage: node ci/no-attribution.mjs --base <sha> --head <sha> [--body-file <path>]');
    process.exit(2);
  }
  const bodyFile = option('--body-file');
  const event = process.env.GITHUB_EVENT_PATH && existsSync(process.env.GITHUB_EVENT_PATH) ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const body = bodyFile ? readFileSync(bodyFile, 'utf8') : (event.pull_request?.body ?? '');
  const commits = commitsBetween(base, head);
  const problems = attributionProblems(commits, body);
  for (const p of problems) console.log(`FAIL ${p}`);
  console.log(problems.length ? `${problems.length} attribution line(s) found; remove them (reword the commits, edit the description).` : `ok: ${commits.length} commit(s) and the description carry no tool attribution.`);
  process.exit(problems.length ? 1 : 0);
}
