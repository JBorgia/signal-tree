import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

interface CausalScenario {
  readonly id: 'authority' | 'atomicity' | 'identity';
  readonly label: string;
  readonly snapshot: string;
  readonly leftTitle: string;
  readonly leftFacts: readonly string[];
  readonly rightTitle: string;
  readonly rightFacts: readonly string[];
  readonly question: string;
  readonly answer: string;
}

interface ValueRow {
  readonly signal: string;
  readonly withoutCausality: string;
  readonly withSignalTree: string;
  readonly value: string;
}

interface Capability {
  readonly index: string;
  readonly title: string;
  readonly detail: string;
  readonly payoff: string;
  readonly tone:
    | 'authored'
    | 'external'
    | 'framework'
    | 'restoration'
    | 'identity';
}

interface AiStage {
  readonly label: string;
  readonly title: string;
  readonly detail: string;
}

@Component({
  selector: 'app-why-causality',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './why-causality.component.html',
  styleUrl: './why-causality.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhyCausalityComponent {
  readonly scenarios: readonly CausalScenario[] = [
    {
      id: 'authority',
      label: 'Authority',
      snapshot: 'order.status = "approved"',
      leftTitle: 'A person approved the order',
      leftFacts: [
        'An authored business decision occurred',
        'The turn may be designated for restoration',
        'An audit can attribute the change to product intent',
      ],
      rightTitle: 'The server reconciled the order',
      rightFacts: [
        'External truth arrived from another authority',
        'Undo must not pretend the application made the decision',
        'The next write may need conflict or freshness policy',
      ],
      question:
        'Should Undo reverse it? May an AI amend it? Who owns the next decision?',
      answer:
        'The value is identical. The valid next action is not. Authority has to be captured when the write enters the system.',
    },
    {
      id: 'atomicity',
      label: 'Operation',
      snapshot: 'available = 8 · reserved = 2',
      leftTitle: 'One allocation committed both values',
      leftFacts: [
        'One transaction owns the complete business operation',
        'Observers receive one coherent publication',
        'Persistence sees the settled result, not a partial state',
      ],
      rightTitle: 'Two unrelated writes happened to agree',
      rightFacts: [
        'Observers may have seen available change before reserved',
        'A failure between writes leaves an invalid intermediate state',
        'Logs cannot recover the missing operation boundary later',
      ],
      question: 'Was this one allocation or two coincidental assignments?',
      answer:
        'A snapshot cannot answer. Coherence is a property of the operation boundary, not of the final object.',
    },
    {
      id: 'identity',
      label: 'Identity',
      snapshot: 'queue = [B, A, C]',
      leftTitle: 'The same subjects were reordered',
      leftFacts: [
        'Held entity locations still identify A, B, and C',
        'History can reverse the structural move',
        'Derived work invalidates from stable subjects',
      ],
      rightTitle: 'Old rows were replaced by lookalikes',
      rightFacts: [
        'Keys and values match while subject continuity is gone',
        'Held references may now point at retired identities',
        'Restoration and subscriptions require different behavior',
      ],
      question: 'Did something move, disappear, or become a new subject?',
      answer:
        'Identity cannot be inferred from equal values. It must survive structural change as its own fact.',
    },
  ];

  readonly selectedScenarioId = signal<CausalScenario['id']>('authority');
  readonly selectedScenario = computed(
    () =>
      this.scenarios.find(({ id }) => id === this.selectedScenarioId()) ??
      this.scenarios[0]
  );

  readonly valueRows: readonly ValueRow[] = [
    {
      signal: 'Recovery',
      withoutCausality:
        'Undo is snapshot replacement or bespoke compensation code that cannot distinguish product intent from synchronization.',
      withSignalTree:
        'Restoration operates on designated authored turns while external truth remains classified separately.',
      value:
        'Fewer destructive reversals and a recovery model the product can explain.',
    },
    {
      signal: 'Operational integrity',
      withoutCausality:
        'A multi-field operation leaks intermediate states to rendering, persistence, analytics, and effects.',
      withSignalTree:
        'Transactions and grouped invalidation publish one settled state across every affected location.',
      value:
        'Less defensive orchestration and fewer impossible states at system boundaries.',
    },
    {
      signal: 'External synchronization',
      withoutCausality:
        'Fetch, save, subscription, retry, and local edits become unrelated conventions around mutable values.',
      withSignalTree:
        'Link connects one location to pull, push, and subscription endpoints without turning the endpoint into another store.',
      value: 'One integration shape with explicit ownership and disposal.',
    },
    {
      signal: 'Long-lived identity',
      withoutCausality:
        'Array position or current key stands in for identity until reorder, removal, restoration, or rekey breaks the assumption.',
      withSignalTree:
        'EntityMap keeps structural membership and stable subject identity inside the same kernel model.',
      value:
        'References, queries, restoration, and UI observation agree about what survived.',
    },
    {
      signal: 'AI execution',
      withoutCausality:
        'An agent receives snapshots and logs, then guesses which changes were intended, settled, external, or reversible.',
      withSignalTree:
        'Applications can expose causal facts and project explanations without making generated prose the source of truth.',
      value:
        'A higher ceiling for reviewable, reversible, policy-constrained automation.',
    },
  ];

  readonly capabilities: readonly Capability[] = [
    {
      index: '01',
      title: 'Authored and external are different facts',
      detail:
        'Ordinary writes, restoration-designated work, and externally realized truth do not collapse into one undifferentiated mutation stream.',
      payoff: 'Undo, audit, and synchronization keep their meanings.',
      tone: 'authored',
    },
    {
      index: '02',
      title: 'A turn is larger than a write',
      detail:
        'Transactions establish the operation boundary; grouped publication lets framework observers reread only after the operation settles.',
      payoff: 'One business action produces one coherent observable result.',
      tone: 'restoration',
    },
    {
      index: '03',
      title: 'Restoration retains effects, not a scrapbook of snapshots',
      detail:
        'Designated turns preserve reversible state effects. Historical states are materialized when requested instead of becoming parallel authority.',
      payoff: 'Recovery is native without making history the live store.',
      tone: 'restoration',
    },
    {
      index: '04',
      title: 'Entity identity survives structure',
      detail:
        'EntityMap treats membership, keys, and stable subjects as related but distinct concerns across reorder, removal, rekey, and restoration.',
      payoff:
        'Held locations and reactive queries keep pointing at the same subject.',
      tone: 'identity',
    },
    {
      index: '05',
      title: 'External relationships have one primitive',
      detail:
        'Link models pull, push, and subscription around a state location while request policy and endpoint behavior remain application-owned.',
      payoff: 'HTTP, storage, and streams share a truthful boundary.',
      tone: 'external',
    },
    {
      index: '06',
      title: 'Native frameworks, one state authority',
      detail:
        'Angular signals, Vue refs, and React external-store selectors observe canonical kernel state instead of mirroring it into framework stores.',
      payoff: 'Native ergonomics without semantic forks.',
      tone: 'framework',
    },
    {
      index: '07',
      title: 'The state shape is the typed API',
      detail:
        'Root, branches, leaves, EntityMaps, and derived values remain navigable through one dot-path grammar with writable and readonly truth in the types.',
      payoff:
        'Less naming ceremony and fewer strings between intent and state.',
      tone: 'framework',
    },
    {
      index: '08',
      title: 'Lifecycle is explicit ownership',
      detail:
        'A tree owns subscriptions, history, and realization resources until destroy() releases a bounded-lifetime tree at its ownership boundary.',
      payoff:
        'SSR requests, tests, and temporary workflows have a real teardown contract.',
      tone: 'identity',
    },
    {
      index: '09',
      title: 'Explanation is a projection, not authority',
      detail:
        'The kernel preserves semantic facts. Products may render audit trails or AI explanations from them without storing narrative as causal truth.',
      payoff: 'Human-readable reasons can evolve without rewriting history.',
      tone: 'authored',
    },
  ];

  readonly aiStages: readonly AiStage[] = [
    {
      label: 'Intent',
      title: 'The application constrains the action',
      detail:
        'Policy, permissions, and product meaning stay outside generated prose.',
    },
    {
      label: 'Turn',
      title: 'The kernel owns the operation boundary',
      detail:
        'Every affected location belongs to one authored or external turn.',
    },
    {
      label: 'Commit',
      title: 'Observers receive settled truth',
      detail:
        'Frameworks render after coherent publication, not during partial mutation.',
    },
    {
      label: 'Receipt',
      title: 'Designated work remains reversible',
      detail:
        'Restoration can reverse the state effect without inventing a new history model.',
    },
    {
      label: 'Projection',
      title: 'People and agents receive an explanation',
      detail:
        'Applications interpret causal facts for review, audit, and next-action planning.',
    },
  ];

  selectScenario(id: CausalScenario['id']): void {
    this.selectedScenarioId.set(id);
  }
}
