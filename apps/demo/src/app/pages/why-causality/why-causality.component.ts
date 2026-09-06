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

interface IncidentStory {
  readonly id: string;
  readonly context: string;
  readonly scale: string;
  readonly title: string;
  readonly record: string;
  readonly causalGap: string;
  readonly counterfactual: string;
  readonly boundary: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly tone: 'market' | 'payment' | 'distributed';
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

  readonly incidents: readonly IncidentStory[] = [
    {
      id: 'knight-capital',
      context: 'Market controls · 2012',
      scale: '$460M loss in 45 minutes',
      title: 'A router kept acting after the market had already answered.',
      record:
        'The SEC found that a faulty deployment activated defective dormant code. While trying to fill 212 customer orders, the router sent more than four million orders, traded over 397 million shares, accumulated billions in unwanted positions, and lost Knight Capital more than $460 million. Ninety-seven automated emails identified an error before the market opened, but they were not designed or handled as system alerts.',
      causalGap:
        'The application-state question is whether customer intent, generated order identity, external fill acknowledgements, aggregate exposure, and deployed operating mode converge into one enforced, settled control state.',
      counterfactual:
        'If an application-owned control surface exists and its policy consults this state, SignalTree can classify fills as external truth, preserve child-order identity in EntityMap, publish exposure changes coherently, and expose one settled invariant before more orders leave.',
      boundary:
        'SignalTree would not have repaired the deployment or supplied the pre-trade risk controls required by the SEC. With no control point, state representation alone changes nothing; its contribution begins where application policy can refuse the next action.',
      sourceLabel: 'U.S. SEC enforcement release 2013-222',
      sourceUrl: 'https://www.sec.gov/newsroom/press-releases/2013-222',
      tone: 'market',
    },
    {
      id: 'citibank-revlon',
      context: 'Payment authorization · 2020',
      scale: '$1.8B loan · unintended early repayment',
      title: 'The transfer was valid data and the wrong business operation.',
      record:
        'Citibank, acting as administrative agent for lenders on a $1.8 billion seven-year Revlon loan, made an accidental and unintended early repayment. Some recipients refused to return the funds. The Second Circuit later held that the lenders were not entitled to repayment at that time; the debt was not due for another three years.',
      causalGap:
        'The legal record establishes an unintended payment, not a missing-state root cause. The application-state question is whether requested operation, present entitlement, approval scope, and external settlement remain distinct facts.',
      counterfactual:
        'Where an application owns pre-submit review, SignalTree can bind authored intent, due-date state, reviewer turns, and external settlement without collapsing them into one amount. Product policy—not SignalTree—decides whether that state blocks egress.',
      boundary:
        'SignalTree cannot reverse a settled transfer or replace banking authorization and payment rails. This source proves the mistaken payment and legal dispute, not a SignalTree-preventable root cause.',
      sourceLabel: 'Second Circuit opinion via Justia (PDF)',
      sourceUrl:
        'https://cases.justia.com/federal/appellate-courts/ca2/21-487/21-487-2022-09-08.pdf?ts=1662663612',
      tone: 'payment',
    },
    {
      id: 'github-partition',
      context: 'Distributed authority · 2018',
      scale: '43 seconds → 24h 11m degradation',
      title: 'Two regions were each true locally and incompatible globally.',
      record:
        'A 43-second network partition triggered failover while East Coast writes had not reached the West Coast. GitHub then had writes in both regions that were absent from the other, stale replicas, and a long fail-forward recovery. More than five million webhook events and 80,000 Pages builds queued; roughly 200,000 webhook payloads later exceeded their internal TTL and were dropped.',
      causalGap:
        'The application-state question is how operator and client surfaces represent write authority, replica freshness, queue identity, expiry, and recovery settlement while infrastructure is degraded.',
      counterfactual:
        'SignalTree cannot fix replication lag or queue throughput. It can represent externally reported authority and application-defined freshness, while EntityMap preserves queued-subject identity. Endpoint policy—not the kernel—owns TTL and expiration decisions.',
      boundary:
        'The partition and recovery remain infrastructure problems. The narrower prevention claim is avoiding a wrong application-owned decision made from state whose degraded authority or freshness was known.',
      sourceLabel: 'GitHub October 21 post-incident analysis',
      sourceUrl:
        'https://github.blog/news-insights/company-news/oct21-post-incident-analysis/',
      tone: 'distributed',
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
