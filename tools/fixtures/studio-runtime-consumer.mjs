import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import * as kernel from '@signal-tree/kernel';
import * as angular from '@signal-tree/angular';
import { isSignal } from '@angular/core';
import {
  treeRuntimeId,
  confirmedTurnReader,
  treeCapabilities,
} from '@signal-tree/kernel/internals';
import { readCanonicalSnapshot } from '@signal-tree/kernel/adapter';
import {
  attachStudio,
  probeSignalTree,
  readCurrentValue,
  readStateShape,
  realizationSupport,
} from '@signal-tree/studio-adapter';
import { handleStudioRequest } from '@signal-tree/studio-adapter/bridge';
const require = createRequire(import.meta.url);
for (const entry of [
  '@signal-tree/angular',
  '@signal-tree/studio-adapter',
  '@signal-tree/studio-adapter/bridge',
  '@signal-tree/kernel/adapter',
  '@signal-tree/kernel/internals',
]) {
  const consumer = createRequire(require.resolve(entry));
  assert.equal(
    realpathSync(consumer.resolve('@signal-tree/kernel')),
    realpathSync(require.resolve('@signal-tree/kernel')),
    `${entry} resolves one installed kernel`
  );
}
assert.equal(angular.entityMap, kernel.entityMap);
assert.equal(angular.transactions, kernel.transactions);
let checks = 0;
for (const [name, api] of [
  ['root', kernel],
  ['angular', angular],
]) {
  const tree = api.signalTree(
    { value: 1, optional: undefined, users: kernel.entityMap() },
    { enhancers: [api.transactions()] }
  );
  const attachment = attachStudio(tree, {
    require: ['committed-transactions'],
  });
  const request = (command, extra = {}) =>
    handleStudioRequest({
      protocol: 1,
      id: 'proof',
      treeId: attachment.id,
      command,
      ...extra,
    });
  try {
    assert.equal(probeSignalTree(tree).runtimeTreeId, treeRuntimeId(tree));
    assert.ok(confirmedTurnReader(tree));
    assert.ok(treeCapabilities(tree).includes('causal-runtime'));
    if (name === 'angular') assert.ok(isSignal(tree.$.value));
    assert.equal(request('startRealizationCapture').ok, true);
    tree
      .transaction(() => {
        if (name === 'angular') tree.$.value.set(2);
        else tree.$.value(2);
        tree.$.users.addOne({ id: 1, name: 'Ada' });
      })
      .confirm();
    assert.deepEqual(readCurrentValue(tree, 'value'), {
      kind: 'value',
      value: 2,
    });
    assert.deepEqual(readCurrentValue(tree, 'optional'), {
      kind: 'value',
      value: undefined,
    });
    assert.deepEqual(readCurrentValue(tree, 'missing'), {
      kind: 'unserializable',
      valueType: 'unresolved-path',
      preview: 'missing',
    });
    assert.equal(readCanonicalSnapshot(tree).users.all[0].name, 'Ada');
    assert.equal(readStateShape(tree).ok, true);
    kernel.external(() => {
      if (name === 'angular') tree.$.value.set(3);
      else tree.$.value(3);
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const inspection = request('readInspection', {
      paths: ['value', 'users'],
      includeStructure: true,
    });
    assert.equal(inspection.ok, true);
    assert.equal(inspection.value.turns.ok, true);
    assert.equal(inspection.value.turns.value.turns.length, 1);
    assert.equal(inspection.value.values.ok, true);
    assert.equal(inspection.value.structure.ok, true);
    assert.equal(inspection.value.realizations.ok, true);
    assert.equal(
      inspection.value.realizations.value.snapshot.effects.length,
      1
    );
    assert.equal(
      inspection.value.realizations.value.snapshot.effects[0].origin,
      'external'
    );
    assert.deepEqual(readCurrentValue(tree, 'value'), {
      kind: 'value',
      value: 3,
    });
    assert.equal(request('stopRealizationCapture').ok, true);
    console.log(
      `PASS packed ${name} native tree: shared kernel identity, confirmed turn, scalar/missing/undefined, EntityMap snapshot, inspection and capture`
    );
    checks++;
  } finally {
    attachment.detach();
    tree.destroy();
  }
  const bare = api.signalTree({ value: 1 });
  const bareAttachment = attachStudio(bare);
  try {
    assert.deepEqual(realizationSupport(probeSignalTree(bare).structure), {
      state: 'unsupported',
      reason: 'leaf-observation-unavailable',
    });
    assert.equal(
      handleStudioRequest({
        protocol: 1,
        id: 'bare',
        treeId: bareAttachment.id,
        command: 'readConfirmedTurns',
      }).ok,
      false
    );
    assert.equal(
      handleStudioRequest({
        protocol: 1,
        id: 'bare',
        treeId: bareAttachment.id,
        command: 'startRealizationCapture',
      }).ok,
      false
    );
    assert.deepEqual(readCurrentValue(bare, 'value'), {
      kind: 'value',
      value: 1,
    });
    console.log(
      `PASS packed ${name} bare tree refuses unsupported evidence/capture while retaining live reads`
    );
    checks++;
  } finally {
    bareAttachment.detach();
    bare.destroy();
  }
}
console.log(`${checks} packed runtime cases passed`);
