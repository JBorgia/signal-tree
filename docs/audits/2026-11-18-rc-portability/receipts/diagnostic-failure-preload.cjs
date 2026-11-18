// Synthetic failing child; exercises the real gate runner's error output path.
const cp = require('node:child_process');
const original = cp.execFileSync;
cp.execFileSync = (command, args, options) => {
  if (command === 'node' && args[0] === 'tools/check-source-controls.mjs') {
    throw Object.assign(new Error('Synthetic diagnostic failure'), {
      status: 1,
      stdout: 'GATE_DIAGNOSTIC_START\n' + 'x'.repeat(200000) + '\nGATE_DIAGNOSTIC_END\n',
      stderr: '',
    });
  }
  return original(command, args, options);
};
require('node:module').syncBuiltinESMExports();
