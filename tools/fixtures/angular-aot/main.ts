import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { defineStore, signalTree } from '@signal-tree/angular';

const localTrees: ReturnType<typeof makeTree>[] = [];
function makeTree() {
  return signalTree({ count: 0 });
}
const LocalStore = defineStore(() => {
  const tree = makeTree();
  localTrees.push(tree);
  return tree;
});
const RootStore = defineStore(makeTree, { providedIn: 'root' });

@Component({
  selector: 'owned-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LocalStore],
  template: '<output id="local">{{ doubled() }}</output>',
})
class OwnedCounter {
  readonly store = inject(LocalStore);
  // Capture this computed once. Writes must invalidate it after initial render.
  readonly doubled = computed(() => this.store.$.count() * 2);
}

@Component({
  selector: 'aot-consumer',
  standalone: true,
  imports: [OwnedCounter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <output id="root">{{ doubled() }}</output>
    @if (visible()) { <owned-counter /> }
  `,
})
class Consumer {
  readonly root = inject(RootStore);
  readonly doubled = computed(() => this.root.$.count() * 2);
  readonly visible = signal(true);
}

void bootstrapApplication(Consumer).then(async (app) => {
  const component = app.components[0].instance as Consumer;
  await app.whenStable();
  Object.assign(window, {
    aotConsumer: {
      production: !isDevMode(),
      write(value: number) {
        component.root.$.count.set(value);
        const local = localTrees.at(-1);
        if (!local) throw new Error('Local store was not created');
        local.$.count.set(value);
        // No detectChanges/tick: the Angular realization must notify rendering.
      },
      hide() {
        component.visible.set(false);
      },
      show() {
        component.visible.set(true);
      },
      snapshot() {
        return {
          localDestroyed: localTrees.map((tree) => tree.destroyed()),
          rootDestroyed: component.root.destroyed(),
        };
      },
      destroy() {
        app.destroy();
      },
    },
  });
});
