import {effect, shallowRef, triggerRef, stop} from '/Users/jonathanborgia/.codex/worktrees/atomic-capture-proof/signaltree/node_modules/vue/index.mjs';
const token = shallowRef(0);
let armed = false;
let delivered = 0;
const runner = effect(() => {
  void token.value;
  delivered++;
  if (armed) throw undefined;
});
armed = true;
let caught = false;
try { triggerRef(token); } catch { caught = true; }
stop(runner);
console.log(JSON.stringify({caught, delivered}));
