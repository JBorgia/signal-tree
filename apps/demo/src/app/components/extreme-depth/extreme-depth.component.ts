import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  signalTree,
  type SignalTree,
  type WritableLeaf,
} from '@signal-tree/angular';

import {
  DEEP_TYPING_BRANCH_SEGMENTS,
  DEEP_TYPING_COMPILER_CHECKS,
  DEEP_TYPING_MAX_DEPTH,
  DEEP_TYPING_MIN_DEPTH,
  isDeepTypingCompiledDepth,
  type DeepTypingCompiledDepth,
  type DeepTypingStatus,
} from './deep-typing-catalog.generated';

interface DeepTypingResultValue {
  readonly status: DeepTypingStatus;
  readonly revision: number;
  readonly owner: string;
}

interface DeepTypingResultNode {
  (): DeepTypingResultValue;
  readonly status: WritableLeaf<DeepTypingStatus>;
  readonly revision: WritableLeaf<number>;
  readonly owner: WritableLeaf<string>;
}

interface RuntimeProof {
  readonly tree: SignalTree<Record<string, unknown>>;
  readonly result: DeepTypingResultNode;
}

const DEFAULT_DEPTH: DeepTypingCompiledDepth = 15;

const pathSegmentsForDepth = (
  depth: DeepTypingCompiledDepth
): readonly string[] => [
  ...DEEP_TYPING_BRANCH_SEGMENTS.slice(0, depth - 1),
  'result',
];

const createNestedState = (
  pathSegments: readonly string[]
): Record<string, unknown> => {
  const branchSegments = pathSegments.slice(0, -1);
  let state: Record<string, unknown> = {
    result: {
      status: 'ready' satisfies DeepTypingStatus,
      revision: 1,
      owner: 'application',
    },
  };

  for (const segment of [...branchSegments].reverse()) {
    state = { [segment]: state };
  }

  return state;
};

const propertyAt = (value: unknown, property: string): unknown => {
  if (
    (typeof value !== 'object' || value === null) &&
    typeof value !== 'function'
  ) {
    throw new Error(`Generated path stopped before ${property}`);
  }

  return (value as Record<string, unknown>)[property];
};

const isWritableLeaf = (value: unknown): boolean =>
  typeof value === 'function' &&
  typeof propertyAt(value, 'set') === 'function' &&
  typeof propertyAt(value, 'update') === 'function';

const resolveResult = (
  tree: SignalTree<Record<string, unknown>>,
  pathSegments: readonly string[]
): DeepTypingResultNode => {
  let current: unknown = tree.$;
  for (const segment of pathSegments) {
    current = propertyAt(current, segment);
  }

  if (
    typeof current !== 'function' ||
    !isWritableLeaf(propertyAt(current, 'status')) ||
    !isWritableLeaf(propertyAt(current, 'revision')) ||
    !isWritableLeaf(propertyAt(current, 'owner'))
  ) {
    throw new Error('Generated deepest branch is not a writable result node');
  }

  return current as unknown as DeepTypingResultNode;
};

const createRuntimeProof = (depth: DeepTypingCompiledDepth): RuntimeProof => {
  const pathSegments = pathSegmentsForDepth(depth);
  const tree = signalTree<Record<string, unknown>>(
    createNestedState(pathSegments)
  );

  try {
    const result = resolveResult(tree, pathSegments);
    if (
      result.status() !== 'ready' ||
      result.revision() !== 1 ||
      result.owner() !== 'application'
    ) {
      throw new Error('Generated deepest branch failed its initial read');
    }

    result.status.set('review');
    result.revision.update((revision) => revision + 1);
    const snapshot = result();
    if (snapshot.status !== 'review' || snapshot.revision !== 2) {
      throw new Error('Generated deepest branch failed its write test');
    }

    result.status.set('ready');
    result.revision.set(1);
    const resetSnapshot = result();
    if (
      resetSnapshot.status !== 'ready' ||
      resetSnapshot.revision !== 1 ||
      resetSnapshot.owner !== 'application'
    ) {
      throw new Error('Generated deepest branch failed its reset test');
    }

    return { tree, result };
  } catch (error) {
    tree.destroy();
    throw error;
  }
};

const parseDepth = (value: string): DeepTypingCompiledDepth | undefined => {
  const depth = Number(value);
  return value.trim() !== '' && isDeepTypingCompiledDepth(depth)
    ? depth
    : undefined;
};

@Component({
  selector: 'app-extreme-depth',
  standalone: true,
  templateUrl: './extreme-depth.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './extreme-depth.component.scss',
})
export class ExtremeDepthComponent implements OnDestroy {
  private readonly proof = signal(createRuntimeProof(DEFAULT_DEPTH));

  readonly minimumDepth = DEEP_TYPING_MIN_DEPTH;
  readonly maximumDepth = DEEP_TYPING_MAX_DEPTH;
  readonly selectedDepth = signal<DeepTypingCompiledDepth>(DEFAULT_DEPTH);
  readonly depthInput = signal(String(DEFAULT_DEPTH));
  readonly depthInputError = computed(() =>
    parseDepth(this.depthInput()) === undefined
      ? `Enter a whole number from ${this.minimumDepth} to ${this.maximumDepth}.`
      : null
  );
  readonly canGenerate = computed(() => this.depthInputError() === null);
  readonly tree = computed(() => this.proof().tree);
  readonly result = computed(() => this.proof().result);
  readonly pathSegments = computed(() =>
    pathSegmentsForDepth(this.selectedDepth())
  );
  readonly compilerChecks = DEEP_TYPING_COMPILER_CHECKS;
  readonly lastOperation = signal(
    `Depth ${DEFAULT_DEPTH} generated; runtime read/write passed.`
  );
  readonly path = computed(() => this.pathSegments().join('.'));
  readonly readExample = computed(
    () => `const status = tree.$.${this.path()}.status();`
  );
  readonly updateExample = computed(
    () => `tree.$.${this.path()}.status.set('review');`
  );

  setDepthInput(value: string): void {
    this.depthInput.set(value);
  }

  generateAndTest(): void {
    const depth = parseDepth(this.depthInput());
    if (depth === undefined) return;

    const nextProof = createRuntimeProof(depth);
    const previousProof = this.proof();
    this.proof.set(nextProof);
    this.selectedDepth.set(depth);
    this.lastOperation.set(
      `Depth ${depth} generated from a compiled fixture; runtime read/write passed.`
    );
    previousProof.tree.destroy();
  }

  toggleStatus(): void {
    const result = this.result();
    result.status.update((status) => (status === 'ready' ? 'review' : 'ready'));
    result.revision.update((revision) => revision + 1);
    this.lastOperation.set('status.set() and revision.update() completed');
  }

  reset(): void {
    const result = this.result();
    result.status.set('ready');
    result.revision.set(1);
    this.lastOperation.set('Deep result reset');
  }

  ngOnDestroy(): void {
    this.tree().destroy();
  }
}
