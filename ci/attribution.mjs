// Tool attribution must never appear in this repository's commit messages or
// pull-request descriptions (Jonathan's decision, November 19). One list of
// patterns serves the commit-msg hook (ci/githooks/commit-msg) and the CI
// check (ci/no-attribution.mjs).

export const ATTRIBUTION_PATTERNS = [
  { name: 'Claude co-author trailer', pattern: /^[ \t]*co-authored-by:[ \t]*claude\b/im },
  { name: '"Generated with Claude Code" line', pattern: /generated with\W{0,3}claude code/i },
  { name: 'Claude session link', pattern: /https?:\/\/(?:www\.)?claude\.(?:ai|com)\/(?:code|chat|share|project)\b/i },
];

/** Every attribution line in `text`: [{ name, line, text }]. */
export function findAttribution(text) {
  const found = [];
  for (const [index, line] of String(text ?? '').split('\n').entries()) {
    for (const { name, pattern } of ATTRIBUTION_PATTERNS) {
      if (pattern.test(line)) found.push({ name, line: index + 1, text: line.trim() });
    }
  }
  return found;
}
