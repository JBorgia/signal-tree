import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  signal,
} from '@angular/core';
import { signalTree, type WritableLeaf } from '@signal-tree/angular';

type DeepStatus = 'ready' | 'review';

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <
  Value
>() => Value extends Right ? 1 : 2
  ? true
  : false;
type IsAny<Value> = 0 extends 1 & Value ? true : false;

interface DeepTypingState {
  enterprise: {
    divisions: {
      technology: {
        departments: {
          engineering: {
            teams: {
              frontend: {
                projects: {
                  signaltree: {
                    releases: {
                      v15: {
                        features: {
                          recursiveTyping: {
                            validation: {
                              result: {
                                status: DeepStatus;
                                revision: number;
                                owner: string;
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}

const PATH_SEGMENTS = [
  'enterprise',
  'divisions',
  'technology',
  'departments',
  'engineering',
  'teams',
  'frontend',
  'projects',
  'signaltree',
  'releases',
  'v15',
  'features',
  'recursiveTyping',
  'validation',
  'result',
] as const;

const createDeepTypingProof = () => {
  const tree = signalTree<DeepTypingState>({
    enterprise: {
      divisions: {
        technology: {
          departments: {
            engineering: {
              teams: {
                frontend: {
                  projects: {
                    signaltree: {
                      releases: {
                        v15: {
                          features: {
                            recursiveTyping: {
                              validation: {
                                result: {
                                  status: 'ready',
                                  revision: 1,
                                  owner: 'application',
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const result =
    tree.$.enterprise.divisions.technology.departments.engineering.teams
      .frontend.projects.signaltree.releases.v15.features.recursiveTyping
      .validation.result;
  const statusLeaf: WritableLeaf<DeepStatus> = result.status;
  const statusIsAny: IsAny<typeof result.status> = false;
  const statusHasExactType: Equal<
    typeof result.status,
    WritableLeaf<DeepStatus>
  > = true;

  return {
    tree,
    result,
    statusLeaf,
    statusIsAny,
    statusHasExactType,
  };
};

@Component({
  selector: 'app-extreme-depth',
  standalone: true,
  templateUrl: './extreme-depth.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './extreme-depth.component.scss',
})
export class ExtremeDepthComponent implements OnDestroy {
  private readonly proof = createDeepTypingProof();

  readonly tree = this.proof.tree;
  readonly result = this.proof.result;
  readonly statusLeaf = this.proof.statusLeaf;
  readonly pathSegments = PATH_SEGMENTS;
  readonly compilerChecks = {
    exactWritableLeaf: this.proof.statusHasExactType,
    isAny: this.proof.statusIsAny,
  } as const;
  readonly lastOperation = signal('No writes yet');
  readonly path = PATH_SEGMENTS.join('.');
  readonly readExample = `const status = tree.$.${this.path}.status();`;
  readonly updateExample = `tree.$.${this.path}.status.set('review');`;

  toggleStatus(): void {
    this.statusLeaf.update((status) =>
      status === 'ready' ? 'review' : 'ready'
    );
    this.result.revision.update((revision) => revision + 1);
    this.lastOperation.set('status.set() and revision.update() completed');
  }

  reset(): void {
    this.statusLeaf.set('ready');
    this.result.revision.set(1);
    this.lastOperation.set('Deep result reset');
  }

  ngOnDestroy(): void {
    this.tree.destroy();
  }
}
