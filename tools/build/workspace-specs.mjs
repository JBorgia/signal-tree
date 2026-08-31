const DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];

export function resolveWorkspaceSpecs(manifest, version) {
  let changed = 0;
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field];
    if (!dependencies) continue;
    for (const name of Object.keys(dependencies)) {
      if (!name.startsWith('@signal-tree/')) continue;
      const spec = dependencies[name];
      if (
        spec === '*' ||
        (typeof spec === 'string' && spec.startsWith('workspace:'))
      ) {
        dependencies[name] = field === 'peerDependencies' ? `^${version}` : version;
        changed++;
      }
    }
  }
  return changed;
}

export function findUnresolvedWorkspaceSpecs(manifest) {
  const unresolved = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries(manifest[field] || {})) {
      if (
        spec === '*' ||
        (typeof spec === 'string' && spec.startsWith('workspace:'))
      ) {
        unresolved.push(`${field}.${name} = ${spec}`);
      }
    }
  }
  return unresolved;
}
