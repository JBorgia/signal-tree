// The CODEOWNERS matcher shared by .github/workflows/approve-non-owned.yml
// (through ci/approve-non-owned.mjs) and the unattended gh wrapper
// (ci/unattended/bin/gh, which runs the copy supervise.sh installs beside it,
// so this file imports nothing but Node built-ins).
//
//   node codeowners.mjs owned <CODEOWNERS> <files.json> <changed-files>
//
// <files.json> is the REST listing of a pull request's files
// (GET /repos/{repo}/pulls/{n}/files), as one array or as the pages
// `gh api --paginate --slurp` prints; <changed-files> is the pull request's
// changed-file count. Prints each code-owned path, the old path of a renamed
// file included, one per line.
//
// Exit status: 0 no path is code-owned; 1 some are (printed); 2 it could not
// decide (bad arguments, an unreadable input, or a listing that is not
// complete). Callers treat anything but 0 as "owned".
//
// Semantics are GitHub's gitignore-style CODEOWNERS rules: comments (also
// after the owners) and blank lines are skipped, and the last rule matching a
// path decides; the path is code-owned when that rule names at least one
// owner. A leading / anchors a pattern to the root; a trailing / matches
// everything under a directory; * and ? match within a path segment, and **
// across segments; a pattern also matches everything under a directory it
// names, except that a final /* matches direct children only.
//
// It fails closed:
// - Any line it cannot parse (! negation, [ ] classes, \ escapes, a ** that is
//   not a whole segment, an empty, . or .. segment, an owner that is not
//   @user, @org/team or an email) and a CODEOWNERS over GitHub's 3 MB limit
//   make every file count as owned.
// - Where GitHub's reading is uncertain it takes the one that owns more: a
//   pattern with a / only in the middle (docs/build) is anchored in gitignore
//   but matched at any depth here too, and owned rules also match
//   case-insensitively. An ownerless rule clears ownership only where it
//   matches under the narrow reading (anchored, case-sensitive).
// - A changed path that is not a plain relative path counts as owned, and a
//   listing with more than GitHub's 3000 files, or a different number of files
//   than the pull request reports, is refused.
import { Buffer } from 'node:buffer';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** GitHub lists at most this many files of a pull request. */
export const FILE_LIMIT = 3000;
/** GitHub ignores a CODEOWNERS file larger than this. */
export const MAX_CODEOWNERS_BYTES = 3 * 1024 * 1024;

const OWNER = /^(?:@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?|[^\s@]+@[^\s@]+\.[^\s@]+)$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const escapeRegExp = (text) => text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');

/** Why `pattern` cannot be matched, or null. */
function patternProblem(pattern) {
  if (pattern.startsWith('!')) return 'negation (!) is not supported by CODEOWNERS';
  if (/[[\]\\]/.test(pattern)) return 'character classes and \\ escapes are not supported by CODEOWNERS';
  if (CONTROL.test(pattern)) return 'a control character';
  const body = pattern.replace(/^\//, '').replace(/\/$/, '');
  if (body === '') return 'an empty pattern';
  for (const segment of body.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') return 'an empty, . or .. segment';
    if (segment.includes('**') && segment !== '**') return '** that is not a whole path segment';
  }
  return null;
}

/**
 * The matcher for one reading of `pattern`: anchored or at any depth, and
 * case-sensitive or not. It takes a path's segments and says whether the
 * pattern matches the path or a directory above it.
 */
function compile(pattern, { anchored, ignoreCase }) {
  let body = pattern.replace(/^\//, '');
  let dirOnly = body.endsWith('/');
  body = body.replace(/\/$/, '');
  let segments = body.split('/').filter((segment, i, all) => !(segment === '**' && all[i - 1] === '**'));
  // dir/** is everything under dir.
  if (segments.length > 1 && segments.at(-1) === '**') {
    segments = segments.slice(0, -1);
    dirOnly = true;
  }
  if (!anchored && segments[0] !== '**') segments = ['**', ...segments];
  const flags = ignoreCase ? 'iu' : 'u';
  const tests = segments.map((segment) =>
    segment === '**' ? null : new RegExp(`^${segment.split('').map((c) => (c === '*' ? '[^/]*' : c === '?' ? '[^/]' : escapeRegExp(c))).join('')}$`, flags),
  );
  // A final /* matches direct children only, not what is under them.
  const directOnly = !dirOnly && segments.length > 1 && segments.at(-1) === '*';

  // Does the pattern match path[0..end) exactly? ** takes zero or more segments.
  const matches = (path, end, p = 0, x = 0) => {
    if (p === tests.length) return x === end;
    if (tests[p] === null) {
      for (let k = x; k <= end; k++) if (matches(path, end, p + 1, k)) return true;
      return false;
    }
    return x < end && tests[p].test(path[x]) && matches(path, end, p + 1, x + 1);
  };
  return (path) => {
    if (!dirOnly && matches(path, path.length)) return true;
    if (directOnly) return false;
    for (let end = 1; end < path.length; end++) if (matches(path, end)) return true;
    return false;
  };
}

/**
 * Parses CODEOWNERS text into rules ({ line, pattern, owners, broad, narrow })
 * and problems (one per line it cannot parse). Any problem means every file
 * counts as owned.
 */
export function parseCodeowners(text) {
  if (typeof text !== 'string') return { rules: [], problems: ['CODEOWNERS is not text'] };
  if (Buffer.byteLength(text, 'utf8') > MAX_CODEOWNERS_BYTES) return { rules: [], problems: [`CODEOWNERS is over GitHub's ${MAX_CODEOWNERS_BYTES}-byte limit, so GitHub ignores it`] };
  const rules = [];
  const problems = [];
  text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = index + 1;
      const tokens = raw.trim().split(/\s+/).filter(Boolean);
      const comment = tokens.findIndex((token) => token.startsWith('#'));
      if (comment !== -1) tokens.length = comment;
      if (tokens.length === 0) return;
      const [pattern, ...owners] = tokens;
      const badOwner = owners.find((owner) => !OWNER.test(owner));
      const problem = patternProblem(pattern) ?? (badOwner === undefined ? null : `owner ${JSON.stringify(badOwner)} is not @user, @org/team or an email`);
      if (problem) {
        problems.push(`line ${line} (${JSON.stringify(pattern)}): ${problem}`);
        return;
      }
      const leading = pattern.startsWith('/');
      const middle = pattern.replace(/^\//, '').replace(/\/$/, '').includes('/');
      rules.push({
        line,
        pattern,
        owners,
        // The reading that matches the most: anchored only by a leading /, any case.
        broad: compile(pattern, { anchored: leading, ignoreCase: true }),
        // The reading that matches the least: gitignore's anchoring, exact case.
        narrow: compile(pattern, { anchored: leading || middle, ignoreCase: false }),
      });
    });
  return { rules, problems };
}

/** True when `path` is a plain relative file path: no leading or trailing /, no empty, . or .. segment. */
export function isPlainPath(path) {
  return typeof path === 'string' && path !== '' && !CONTROL.test(path) && path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** Whether the last rule that may match `segments` has owners, under the readings above. */
function owned(rules, segments) {
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (rule.owners.length > 0) {
      if (rule.broad(segments)) return true;
    } else if (rule.narrow(segments)) {
      return false;
    }
  }
  return false;
}

/**
 * The files in `files` that are code-owned under `codeownersText`, in their
 * first order, without repeats. Every file is when the text has a line that
 * cannot be parsed; a path that is not plain always is.
 */
export function ownedPaths(codeownersText, files) {
  const unique = [...new Set(files)];
  const { rules, problems } = parseCodeowners(codeownersText);
  if (problems.length > 0) return unique;
  return unique.filter((file) => !isPlainPath(file) || owned(rules, file.split('/')));
}

/**
 * Every path a pull request touches: each file's name and, for a renamed
 * file, its old name. `files` is the REST listing (one array, or an array of
 * pages); `changedFiles` is the pull request's changed_files. Throws when the
 * listing cannot be complete or is malformed.
 */
export function changedPaths(files, changedFiles) {
  const list = Array.isArray(files) && files.length > 0 && files.every(Array.isArray) ? files.flat() : files;
  if (!Array.isArray(list)) throw new Error('the changed files are not a list');
  if (!Number.isSafeInteger(changedFiles) || changedFiles < 0) throw new Error(`the changed-file count ${JSON.stringify(changedFiles)} is not a number`);
  if (changedFiles > FILE_LIMIT) throw new Error(`${changedFiles} files changed; GitHub lists at most ${FILE_LIMIT}, so the rest cannot be checked`);
  if (list.length !== changedFiles) throw new Error(`GitHub listed ${list.length} changed files of ${changedFiles}`);
  const paths = [];
  for (const file of list) {
    if (typeof file?.filename !== 'string') throw new Error('a changed file has no filename');
    paths.push(file.filename);
    if (file.previous_filename != null) {
      if (typeof file.previous_filename !== 'string') throw new Error(`${file.filename} has a malformed previous_filename`);
      paths.push(file.previous_filename);
    }
  }
  return [...new Set(paths)];
}

const printable = (path) => (CONTROL.test(path) ? JSON.stringify(path) : path);

/** The command line; returns the exit status. */
export function cli(args, { out = console.log, err = console.error } = {}) {
  const [command, codeownersFile, filesFile, count] = args;
  if (command !== 'owned' || args.length !== 4) {
    err('usage: node codeowners.mjs owned <CODEOWNERS> <files.json> <changed-files>');
    return 2;
  }
  try {
    const text = readFileSync(codeownersFile, 'utf8');
    const paths = changedPaths(JSON.parse(readFileSync(filesFile, 'utf8')), /^\d+$/.test(count) ? Number(count) : count);
    for (const problem of parseCodeowners(text).problems) err(`codeowners: CODEOWNERS ${problem}; every file counts as code-owned`);
    const found = ownedPaths(text, paths);
    for (const path of found) out(printable(path));
    return found.length > 0 ? 1 : 0;
  } catch (error) {
    err(`codeowners: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = cli(process.argv.slice(2));
}
