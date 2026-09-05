#!/usr/bin/env node
import semver from 'semver';

export const parseRemoteTagNames = (output) =>
  output
    .split('\n')
    .map((line) => line.match(/^[0-9a-f]+\trefs\/tags\/(.+)$/)?.[1])
    .filter((tag) => tag !== undefined);

const sameBaseRc = (current, tag) => {
  const version = semver.valid(tag.startsWith('v') ? tag.slice(1) : tag);
  if (!version) return undefined;
  const parsed = semver.parse(version);
  const base = semver.parse(current);
  const prerelease = parsed?.prerelease;
  if (
    !parsed ||
    !base ||
    parsed.major !== base.major ||
    parsed.minor !== base.minor ||
    parsed.patch !== base.patch ||
    prerelease?.[0] !== 'rc' ||
    !Number.isSafeInteger(prerelease[1])
  ) {
    return undefined;
  }
  return version;
};

export const deriveReleaseVersion = (current, releaseType, tags = []) => {
  if (releaseType !== 'rc') {
    return {
      version: semver.inc(current, releaseType),
      resumeFrom: undefined,
    };
  }

  if (semver.prerelease(current)) {
    return {
      version: semver.inc(current, 'prerelease', 'rc'),
      resumeFrom: undefined,
    };
  }

  const latestSameBaseRc = tags
    .map((tag) => sameBaseRc(current, tag))
    .filter((version) => version !== undefined)
    .sort(semver.rcompare)[0];

  return latestSameBaseRc
    ? {
        version: semver.inc(latestSameBaseRc, 'prerelease', 'rc'),
        resumeFrom: current,
      }
    : {
        version: semver.inc(current, 'prerelease', 'rc'),
        resumeFrom: undefined,
      };
};

const selfTest = () => {
  const cases = [
    {
      name: 'resume a same-base RC line after stable preparation',
      actual: deriveReleaseVersion('15.0.0', 'rc', [
        'v15.0.0-rc.12',
        'v15.0.0-rc.9',
        'v14.1.1',
      ]),
      expected: { version: '15.0.0-rc.13', resumeFrom: '15.0.0' },
    },
    {
      name: 'advance an active RC line',
      actual: deriveReleaseVersion('15.0.0-rc.12', 'rc', [
        'v15.0.0-rc.12',
      ]),
      expected: { version: '15.0.0-rc.13', resumeFrom: undefined },
    },
    {
      name: 'retain legacy next-patch behavior without same-base RC tags',
      actual: deriveReleaseVersion('15.0.0', 'rc', ['v14.1.1']),
      expected: { version: '15.0.1-rc.0', resumeFrom: undefined },
    },
    {
      name: 'ignore malformed and other-base RC tags',
      actual: deriveReleaseVersion('15.0.0', 'rc', [
        'v15.0.1-rc.7',
        'v15.0.0-beta.2',
        'not-a-version',
      ]),
      expected: { version: '15.0.1-rc.0', resumeFrom: undefined },
    },
  ];

  for (const { name, actual, expected } of cases) {
    if (
      actual.version !== expected.version ||
      actual.resumeFrom !== expected.resumeFrom
    ) {
      throw new Error(
        `${name}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
      );
    }
  }
  const parsedTags = parseRemoteTagNames(
    'abc123\trefs/tags/v15.0.0-rc.12\n' +
      'def456\trefs/tags/v15.0.0\n' +
      'ignored\trefs/heads/main\n'
  );
  if (
    parsedTags.length !== 2 ||
    parsedTags[0] !== 'v15.0.0-rc.12' ||
    parsedTags[1] !== 'v15.0.0'
  ) {
    throw new Error(`remote tag parsing failed: ${JSON.stringify(parsedTags)}`);
  }
  console.log(`Release-version derivation self-test passed (${cases.length} cases).`);
};

if (process.argv.includes('--self-test')) selfTest();
