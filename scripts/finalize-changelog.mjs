#!/usr/bin/env node
/**
 * finalize-changelog.mjs — stamp the release date onto the top CHANGELOG entry.
 *
 * Rewrites the FIRST `## ` heading when it is an "Unreleased-for-this-version"
 * heading ("## Unreleased (X.Y.Z)") or a bare "## Unreleased" heading into a
 * dated "## X.Y.Z (YYYY-MM-DD)" heading, for the version being released.
 *
 * Why this exists: scripts/release.sh bumps package.json to X.Y.Z, but nothing
 * used to rewrite the "## Unreleased (X.Y.Z)" heading. The release-state gate
 * then only passed pre-bump (against the OLD version); post-bump the shipped
 * version would still say "Unreleased" and main would go red on the next
 * validate. release.sh now bumps → finalizes here → validates, so the
 * release-state gate sees package.json == CHANGELOG == X.Y.Z (RFC 0004
 * v12-audit intake, 2026-07-24).
 *
 * Guarantees:
 *   - Idempotent: if the top heading is already "## X.Y.Z (...)", it is left
 *     untouched (exit 0). Running twice never double-dates.
 *   - Fails loudly (exit 1) if the top heading is neither an Unreleased heading
 *     for this version / bare Unreleased, nor an already-dated heading for this
 *     version — so release.sh can never publish an undocumented version.
 *   - Touches ONLY the first heading line; the rest of the file is byte-stable.
 *
 * Usage:
 *   node scripts/finalize-changelog.mjs <version> [--date YYYY-MM-DD]
 * release.sh passes --date "$(date +%Y-%m-%d)" so the stamped date matches the
 * host's local date (node's default would be UTC).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const finalizeChangelogText = (
  text,
  { version, today, resumeFrom }
) => {
  const lines = text.split('\n');
  const headingIdx = lines.findIndex((line) => /^##\s+/.test(line));
  if (headingIdx === -1) {
    throw new Error('no "## " heading found in CHANGELOG.md');
  }

  const heading = lines[headingIdx];
  const versionPattern = escapeRegex(version);
  const alreadyThis = new RegExp(
    `^##\\s+v?${versionPattern}\\s+\\(\\d{4}-\\d{2}-\\d{2}\\)\\s*$`
  );
  if (alreadyThis.test(heading)) {
    return { text, heading, changed: false };
  }

  const unreleasedThis = new RegExp(
    `^##\\s+Unreleased\\s*\\(\\s*${versionPattern}\\s*\\)\\s*$`,
    'i'
  );
  const unreleasedBare = /^##\s+Unreleased\s*$/i;
  const resumeHeading = resumeFrom
    ? new RegExp(
        `^##\\s+v?${escapeRegex(resumeFrom)}\\s+\\(\\d{4}-\\d{2}-\\d{2}\\)\\s*$`
      )
    : undefined;

  if (
    !unreleasedThis.test(heading) &&
    !unreleasedBare.test(heading) &&
    !resumeHeading?.test(heading)
  ) {
    const resumeDescription = resumeFrom
      ? ` nor the authorized resume base "## ${resumeFrom} (...)"`
      : '';
    throw new Error(
      `top CHANGELOG heading is "${heading.trim()}", which is neither ` +
        `"## Unreleased (${version})" / "## Unreleased" nor an already-dated ` +
        `"## ${version} (...)"${resumeDescription}`
    );
  }

  lines[headingIdx] = `## ${version} (${today})`;
  return { text: lines.join('\n'), heading, changed: true };
};

const runSelfTest = () => {
  const resumed = finalizeChangelogText('## 15.0.0 (2026-09-03)\nbody\n', {
    version: '15.0.0-rc.13',
    today: '2026-09-05',
    resumeFrom: '15.0.0',
  });
  if (resumed.text !== '## 15.0.0-rc.13 (2026-09-05)\nbody\n') {
    throw new Error('same-base RC resume did not rewrite the stable heading');
  }

  let refused = false;
  try {
    finalizeChangelogText('## 15.0.0 (2026-09-03)\n', {
      version: '15.0.0-rc.13',
      today: '2026-09-05',
    });
  } catch {
    refused = true;
  }
  if (!refused) throw new Error('stable heading changed without --resume-from');
  let malformedAccepted = false;
  try {
    finalizeChangelogText('## 15.0.0-rc.13 (draft)\n', {
      version: '15.0.0-rc.13',
      today: '2026-09-05',
    });
    malformedAccepted = true;
  } catch {
    // Expected: idempotence requires a dated heading.
  }
  if (malformedAccepted) throw new Error('malformed target heading was accepted');
  console.log('Changelog finalization self-test passed (resume and refusal).');
};

if (process.argv.includes('--self-test')) {
  runSelfTest();
  process.exit(0);
}

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('❌ finalize-changelog: missing/invalid <version> argument');
  console.error(
    '   Usage: node scripts/finalize-changelog.mjs <version> [--date YYYY-MM-DD]'
  );
  process.exit(2);
}

const dateIdx = process.argv.indexOf('--date');
const today =
  dateIdx !== -1 && process.argv[dateIdx + 1]
    ? process.argv[dateIdx + 1]
    : new Date().toISOString().slice(0, 10);
const resumeIdx = process.argv.indexOf('--resume-from');
const resumeFrom = resumeIdx !== -1 ? process.argv[resumeIdx + 1] : undefined;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = resolve(root, 'CHANGELOG.md');
const text = readFileSync(changelogPath, 'utf8');

try {
  const result = finalizeChangelogText(text, { version, today, resumeFrom });
  if (result.changed) writeFileSync(changelogPath, result.text);
  console.log(
    result.changed
      ? `✅ finalize-changelog: "${result.heading.trim()}" → "## ${version} (${today})"`
      : `✅ finalize-changelog: top heading already "${result.heading.trim()}" — no change (idempotent)`
  );
} catch (error) {
  console.error(`❌ finalize-changelog: ${error.message}. Refusing to finalize.`);
  process.exit(1);
}
