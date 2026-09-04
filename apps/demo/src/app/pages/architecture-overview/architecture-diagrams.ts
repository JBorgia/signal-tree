import type {
  ArchitectureDiagramEdge,
  ArchitectureDiagramNode,
  ArchitectureDiagramSpec,
  ArchitectureDiagramTone,
  DiagramBox,
} from './architecture-diagram.types';

const box = (
  x: number,
  y: number,
  width: number,
  height: number
): DiagramBox => ({ x, y, width, height });

const node = (
  id: string,
  title: readonly string[],
  detail: readonly string[],
  tone: ArchitectureDiagramTone,
  desktop: DiagramBox,
  mobile: DiagramBox,
  code = false,
  mobileTitle?: readonly string[],
  mobileDetail?: readonly string[]
): ArchitectureDiagramNode => ({
  id,
  title,
  detail,
  mobileTitle,
  mobileDetail,
  tone,
  position: { desktop, mobile },
  code,
});

const edge = (
  id: string,
  from: string,
  to: string,
  label?: string,
  options: Partial<ArchitectureDiagramEdge> = {}
): ArchitectureDiagramEdge => ({
  id,
  from,
  to,
  label,
  direction: 'forward',
  ...options,
});

export const SYSTEM_BOUNDARY_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'system-boundary',
  eyebrow: '01 · System boundary',
  title: 'SignalTree in one picture',
  takeaway:
    'Frameworks realize canonical truth; the kernel remains the state authority.',
  description:
    'Application policy chooses the work. Framework realizations connect that work to their observation runtimes. The framework-neutral kernel owns the state and causal model beneath them.',
  plainLanguage:
    'Your app decides what should happen, the framework updates the screen, and SignalTree keeps the one official answer underneath.',
  realWorldExample:
    'A shopper changes an item quantity. The checkout rule accepts the change, SignalTree stores it, and the application’s framework realization redraws the total.',
  financialImpact:
    'If the screen and store keep separate answers, a shopper can see one total and be charged another. One authority keeps those numbers together.',
  desktopViewBox: '0 0 1040 720',
  mobileViewBox: '0 0 360 720',
  nodes: [
    node(
      'policy',
      ['Application policy'],
      ['decides product work'],
      'application',
      box(200, 30, 640, 105),
      box(24, 30, 312, 110)
    ),
    node(
      'realization',
      ['Framework', 'realization'],
      ['observe · render · clean up'],
      'framework',
      box(200, 190, 640, 115),
      box(24, 195, 312, 125)
    ),
    node(
      'kernel',
      ['SignalTree', 'causal kernel'],
      ['framework-neutral authority'],
      'kernel',
      box(200, 360, 640, 140),
      box(24, 375, 312, 140)
    ),
    node(
      'facts',
      ['state · identity · authority'],
      ['causal turns · operation boundaries'],
      'neutral',
      box(200, 560, 640, 110),
      box(24, 570, 312, 105)
    ),
  ],
  edges: [
    edge('policy-realization', 'policy', 'realization', 'product intent'),
    edge('realization-kernel', 'realization', 'kernel', 'writes + rereads'),
    edge('kernel-facts', 'kernel', 'facts', 'owns'),
  ],
  checks: [
    'The framework layer is observation and realization, not a second store.',
    'The kernel contract contains no framework runtime dependency.',
  ],
  evidence: [
    'packages/kernel/src/adapter.ts',
    'packages/angular/src/index.ts',
    'packages/react/src/use-signal-tree.ts',
    'packages/vue/src/index.ts',
  ],
};

export const PACKAGE_OWNERSHIP_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'package-ownership',
  eyebrow: '02 · Package ownership',
  title: 'Four public packages, one semantic authority',
  takeaway:
    'Applications import their framework facade; framework-neutral code imports the kernel.',
  description:
    'Framework packages add native observation and lifecycle integration around the same kernel types and runtime. The adapter subpath exists for observation-adapter authors, not ordinary application imports.',
  plainLanguage:
    'Choose the package that matches your app. It includes the shared SignalTree engine plus the connection your framework needs.',
  realWorldExample:
    'An Angular checkout imports @signal-tree/angular, a Vue dispatch screen imports @signal-tree/vue, and a framework-free pricing library imports @signal-tree/kernel.',
  financialImpact:
    'One import path avoids duplicate integration code and competing state copies, reducing maintenance work and costly checkout defects.',
  desktopViewBox: '0 0 1040 500',
  mobileViewBox: '0 0 360 590',
  nodes: [
    node(
      'angular',
      ['@signal-tree/angular'],
      ['Angular observation · DI · DestroyRef'],
      'framework',
      box(35, 35, 285, 85),
      box(12, 20, 164, 105),
      true,
      ['@signal-tree/', 'angular'],
      ['Angular observation', 'DI · DestroyRef']
    ),
    node(
      'react',
      ['@signal-tree/react'],
      ['useSignalTree(owner, selector)'],
      'framework',
      box(35, 140, 285, 85),
      box(184, 20, 164, 105),
      true,
      ['@signal-tree/', 'react'],
      ['useSignalTree', '(owner, selector)']
    ),
    node(
      'vue',
      ['@signal-tree/vue'],
      ['direct Vue dependency observation'],
      'framework',
      box(35, 245, 285, 85),
      box(12, 355, 164, 105),
      true,
      ['@signal-tree/', 'vue'],
      ['direct Vue', 'observation']
    ),
    node(
      'neutral-libraries',
      ['Framework-neutral', 'TypeScript'],
      ['no realization runtime'],
      'application',
      box(35, 350, 285, 85),
      box(184, 355, 164, 105)
    ),
    node(
      'kernel-package',
      ['@signal-tree/kernel'],
      ['state · identity · causal turns', 'Link · restoration · invalidation'],
      'kernel',
      box(585, 145, 410, 190),
      box(98, 170, 164, 140),
      true,
      ['@signal-tree/', 'kernel']
    ),
    node(
      'adapter',
      ['kernel/adapter'],
      ['realization SDK'],
      'neutral',
      box(650, 385, 280, 80),
      box(98, 485, 164, 80),
      true
    ),
  ],
  edges: [
    edge('angular-kernel', 'angular', 'kernel-package', 'forwards + realizes'),
    edge('react-kernel', 'react', 'kernel-package', 'forwards + observes'),
    edge('vue-kernel', 'vue', 'kernel-package', 'forwards + observes'),
    edge('neutral-kernel', 'neutral-libraries', 'kernel-package', 'imports'),
    edge('adapter-kernel', 'adapter', 'kernel-package', 'narrow contract', {
      direction: 'both',
      dashed: true,
    }),
  ],
  checks: [
    'The current package set is kernel, Angular, React, and Vue.',
    'Framework packages do not create independent state authority.',
    'Bounded owners release resources with destroy(); Angular defineStore binds that to DestroyRef.',
  ],
  evidence: [
    'scripts/release-plan.mjs',
    'packages/kernel/src/adapter.ts',
    'packages/angular/src/lib/define-store.ts',
    'packages/react/src/use-signal-tree.ts',
    'packages/vue/src/lib/vue-observation.ts',
  ],
};

export const ACCESSOR_GRAMMAR_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'accessor-grammar',
  eyebrow: '03 · Public state grammar',
  title: 'The API follows the shape of the location',
  takeaway:
    'Root, branches, and terminal leaves share one callable grammar; leaf(value) declares where topology stops.',
  description:
    'The controller itself is not callable. Its root $, branch accessors, and terminal locations support read, whole-value replacement, and updater calls. leaf(value) makes an object or callable terminal instead of traversable; wrapping a callable again at write time distinguishes data from an updater. EntityMap exposes collection operations.',
  plainLanguage:
    'The way you read or change state matches what you are touching: the whole tree, one object, one simple value, or a keyed collection.',
  realWorldExample:
    'A checkout replaces a complete shipping address, increments an item quantity, and looks up products by ID through their matching APIs.',
  financialImpact:
    'The type system catches accidental partial replacements that could erase an address field, drop an item, or calculate an order from incomplete data.',
  desktopViewBox: '0 0 1040 455',
  mobileViewBox: '0 0 360 900',
  nodes: [
    node(
      'root',
      ['Root accessor'],
      ['tree.$()', 'tree.$(next)', 'tree.$(current => next)'],
      'kernel',
      box(25, 70, 235, 295),
      box(24, 20, 312, 180),
      true
    ),
    node(
      'branch',
      ['Branch accessor'],
      [
        'tree.$.profile()',
        'tree.$.profile(next)',
        'tree.$.profile(current => next)',
      ],
      'authored',
      box(275, 70, 235, 295),
      box(24, 230, 312, 195),
      true
    ),
    node(
      'leaf',
      ['Terminal location'],
      [
        'leaf({ start, end })',
        'location() / location(next)',
        'location(current => next)',
        'location(leaf(callback))',
      ],
      'framework',
      box(525, 70, 235, 295),
      box(24, 455, 312, 195),
      true
    ),
    node(
      'entity-map',
      ['EntityMap collection'],
      ['rows.all()', 'rows.setAll(next)', 'rows.changeId(from, to)'],
      'identity',
      box(775, 70, 240, 295),
      box(24, 680, 312, 195),
      true
    ),
  ],
  edges: [],
  checks: [
    'tree is a controller and is not callable.',
    'A branch call replaces a whole branch value; partial objects do not compile.',
    'Terminal leaves use the same read, replace, and derive grammar.',
    'leaf(callable) distinguishes callable data from an updater.',
  ],
  evidence: [
    'packages/kernel/src/lib/callable-contract.typing.spec.ts',
    'packages/kernel/src/lib/root-accessor-contract.typing.spec.ts',
    'packages/kernel/src/lib/signal-tree.ts',
  ],
};

export const CAUSAL_AUTHORITY_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'causal-authority',
  eyebrow: '04 · Causal write model',
  title: 'Authority and restoration are separate axes',
  takeaway:
    'Ordinary application writes are authored; undoable() designates authored work for restoration.',
  description:
    'external() means another authority owned the decision. Transactions can group authored work and defer settlement, but they are not a third authority class.',
  plainLanguage:
    'SignalTree records who chose a change. Your user chose authored changes; a server or device chose external changes. Only chosen authored work belongs in undo history.',
  realWorldExample:
    'A clerk edits an invoice note while the server sends a new tax rate. Undo reverses the note edit without pretending the clerk chose the tax rate.',
  financialImpact:
    'Undoing an authoritative tax, price, or payment update could produce the wrong total. Separating authority protects business truth from a user undo.',
  desktopViewBox: '0 0 1040 760',
  mobileViewBox: '0 0 360 850',
  groups: [
    {
      id: 'transaction-boundary',
      label: 'Orthogonal operation boundary · transaction()',
      tone: 'neutral',
      position: {
        desktop: box(185, 20, 670, 120),
        mobile: box(12, 15, 336, 115),
      },
      dashed: true,
    },
  ],
  nodes: [
    node(
      'operation',
      ['operation'],
      ['may be pending until confirm / rollback'],
      'neutral',
      box(315, 55, 410, 65),
      box(24, 45, 312, 65)
    ),
    node(
      'write',
      ['WRITE'],
      ['classify who owned the decision'],
      'kernel',
      box(365, 185, 310, 90),
      box(24, 180, 312, 95)
    ),
    node(
      'authored',
      ['Authored'],
      ['ordinary application writes', 'including transaction work'],
      'authored',
      box(80, 340, 350, 115),
      box(12, 330, 164, 125)
    ),
    node(
      'external',
      ['External'],
      ['external(() => applyTruth())', 'never an authored turn'],
      'external',
      box(610, 340, 350, 115),
      box(184, 330, 164, 125),
      true,
      undefined,
      ['external(() =>', 'applyTruth())', 'never an authored turn']
    ),
    node(
      'undesignated',
      ['Undesignated', 'by default'],
      ['no restoration retention'],
      'neutral',
      box(25, 510, 295, 80),
      box(12, 520, 164, 100)
    ),
    node(
      'designation',
      ['Restoration', 'designation'],
      ['undoable(() => authoredWork())'],
      'restoration',
      box(365, 500, 310, 100),
      box(184, 510, 164, 120),
      true,
      undefined,
      ['undoable(() =>', 'authoredWork())']
    ),
    node(
      'history',
      ['Eligible for retained', 'restoration history'],
      ['bounded by restoration policy'],
      'restoration',
      box(365, 660, 310, 80),
      box(184, 700, 164, 120),
      false,
      ['Eligible for', 'retained', 'restoration history'],
      ['bounded by', 'restoration policy']
    ),
  ],
  edges: [
    edge('operation-write', 'operation', 'write', 'groups', { dashed: true }),
    edge('write-authored', 'write', 'authored', 'this operation'),
    edge('write-external', 'write', 'external', 'another authority'),
    edge('authored-default', 'authored', 'undesignated', 'ordinary'),
    edge('authored-designated', 'authored', 'designation', 'optional'),
    edge('designation-history', 'designation', 'history', 'eligible'),
  ],
  checks: [
    'undoable() does not make a write authored and does not create a turn boundary.',
    'external() classifies provenance; it does not make a write invisible or consequence-free.',
    'Transactions are grouping and settlement machinery, not authority classification.',
  ],
  evidence: [
    'packages/kernel/src/lib/external.ts',
    'packages/kernel/src/lib/undoable.ts',
    'packages/kernel/src/enhancers/transactions/transactions.ts',
    'packages/angular/src/lib/public-surface.spec.ts',
  ],
};

export const COHERENT_OPERATION_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'coherent-operation',
  eyebrow: '05 · Atomic observation',
  title: 'One semantic operation, one coherent observed state',
  takeaway:
    'A transaction may span multiple private commits without exposing a partial state.',
  description:
    'SignalTree defines atomicity by externally observable coherence, not by counting internal revision increments. Publication happens only after the operation can be observed as a complete state.',
  plainLanguage:
    'Several related changes may happen inside, but everyone watching sees them arrive together as one complete result.',
  realWorldExample:
    'Moving $20 from checking to savings changes both balances. The screen never sees the debit without the matching credit.',
  financialImpact:
    'A half-finished transfer can trigger a false overdraft, fee, or alert. Coherent publication prevents decisions based on that temporary state.',
  desktopViewBox: '0 0 1040 520',
  mobileViewBox: '0 0 360 915',
  nodes: [
    node(
      'transaction',
      ['transaction(() => …)'],
      ['one semantic operation'],
      'application',
      box(30, 175, 190, 100),
      box(24, 20, 312, 100),
      true
    ),
    node(
      'mutations',
      ['multiple mutations'],
      ['scalar + structural'],
      'authored',
      box(265, 175, 190, 100),
      box(24, 170, 312, 100)
    ),
    node(
      'commits',
      ['private substrate', 'commits'],
      ['one or more'],
      'neutral',
      box(500, 175, 190, 100),
      box(24, 320, 312, 105)
    ),
    node(
      'publication',
      ['coherent publication'],
      ['no heterogeneous midpoint'],
      'kernel',
      box(735, 175, 270, 100),
      box(24, 475, 312, 105)
    ),
    node(
      'invalidation',
      ['framework invalidation'],
      ['request to reread truth'],
      'framework',
      box(600, 350, 270, 100),
      box(24, 630, 312, 105)
    ),
    node(
      'observer',
      ['observer'],
      ['sees only the final state'],
      'identity',
      box(230, 350, 270, 100),
      box(24, 785, 312, 105)
    ),
  ],
  edges: [
    edge('transaction-mutations', 'transaction', 'mutations'),
    edge('mutations-commits', 'mutations', 'commits'),
    edge('commits-publication', 'commits', 'publication'),
    edge('publication-invalidation', 'publication', 'invalidation'),
    edge('invalidation-observer', 'invalidation', 'observer', 'reread'),
  ],
  checks: [
    'Physical revisions are implementation stamps, not transaction identities.',
    'Observers cannot see scalar-only or structural-only intermediate transaction state.',
    'Owner invalidation carries no value or path; the framework rereads canonical truth.',
  ],
  evidence: [
    'packages/kernel/src/lib/heterogeneous-atomicity.spec.ts',
    'packages/kernel/src/adapter.ts',
    'packages/kernel/src/lib/owner-invalidation.spec.ts',
  ],
};

export const ENTITY_IDENTITY_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'entity-identity',
  eyebrow: '06 · Entity identity',
  title: 'Keys and positions can change without changing the subject',
  takeaway:
    'A held entity facade follows SubjectId through reorder, rekey, and supported restoration.',
  description:
    'EntityMap separates stable subject identity from lookup key and collection position. A fresh occupant that later reuses an old key receives a different subject identity.',
  plainLanguage:
    'A record stays the same thing even when it moves in a list or swaps a temporary ID for the server ID.',
  realWorldExample:
    'A new order starts as tmp-1, moves after sorting, and later becomes order-8492. A held row reference still points to that same order.',
  financialImpact:
    'Losing identity can duplicate an order, apply a refund to the wrong row, or charge twice when a temporary key becomes permanent.',
  desktopViewBox: '0 0 1040 500',
  mobileViewBox: '0 0 360 940',
  nodes: [
    node(
      'initial',
      ['Subject S42'],
      ['key tmp-1 · position A'],
      'identity',
      box(20, 90, 220, 110),
      box(24, 20, 312, 105)
    ),
    node(
      'reordered',
      ['Subject S42'],
      ['key tmp-1 · position B'],
      'identity',
      box(410, 90, 220, 110),
      box(24, 175, 312, 105)
    ),
    node(
      'rekeyed',
      ['Subject S42'],
      ['key server-99 · position B'],
      'identity',
      box(800, 90, 220, 110),
      box(24, 330, 312, 105)
    ),
    node(
      'inactive',
      ['Subject S42'],
      ['inactive · restoration-owned'],
      'restoration',
      box(800, 360, 220, 110),
      box(24, 485, 312, 105)
    ),
    node(
      'restored',
      ['Subject S42'],
      ['reactivated at exact target'],
      'identity',
      box(410, 360, 220, 110),
      box(24, 640, 312, 105)
    ),
    node(
      'held',
      ['held facade'],
      ['same logical subject'],
      'kernel',
      box(20, 360, 220, 110),
      box(24, 795, 312, 105)
    ),
  ],
  edges: [
    edge('initial-reordered', 'initial', 'reordered', 'reorder'),
    edge('reordered-rekeyed', 'reordered', 'rekeyed', 'changeId()'),
    edge('rekeyed-inactive', 'rekeyed', 'inactive', 'designated remove'),
    edge('inactive-restored', 'inactive', 'restored', 'undo'),
    edge('restored-held', 'restored', 'held', 'still resolves', {
      dashed: true,
    }),
  ],
  checks: [
    'PositionId, SubjectId, storage slot, and key/path are distinct coordinates.',
    'changeId() preserves the held subject and rejects occupied target keys.',
    'Key reuse never aliases a fresh member to the retired subject.',
  ],
  evidence: [
    'packages/kernel/src/lib/e-subject-identity-audit.spec.ts',
    'packages/kernel/src/lib/e-ordering-rekey.spec.ts',
    'packages/kernel/src/lib/entity-restoration-authority.spec.ts',
  ],
};

export const LINK_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'link',
  eyebrow: '07 · External relationship',
  title: 'Link owns synchronization, not backend policy',
  takeaway:
    'The kernel owns the relationship semantics; endpoint code owns transport and durability choices.',
  description:
    'A Link can pull endpoint truth, push settled tree truth, or subscribe to live endpoint truth. Inbound values are applied as external authority. The endpoint decides storage, transport, codec, retry, cache, and scheduling policy.',
  plainLanguage:
    'Link keeps a state location connected to something outside. Your application still decides how to fetch, save, retry, and store that data.',
  realWorldExample:
    'A saved cart loads from an API, sends settled edits back, and listens for stock changes. The API service owns HTTP and retry rules.',
  financialImpact:
    'Keeping retry and durability policy in endpoint code makes duplicate charges and lost saves easier to prevent, test, and audit.',
  desktopViewBox: '0 0 1040 465',
  mobileViewBox: '0 0 360 840',
  nodes: [
    node(
      'tree-location',
      ['SignalTree location'],
      ['canonical authored truth'],
      'kernel',
      box(35, 145, 245, 120),
      box(120, 20, 120, 120),
      false,
      ['SignalTree', 'location'],
      ['canonical', 'authored truth']
    ),
    node(
      'link-primitive',
      ['Link'],
      ['retrieve() · settled() · dispose()'],
      'restoration',
      box(390, 125, 260, 160),
      box(228, 220, 120, 140),
      true,
      undefined,
      ['retrieve()', 'settled()', 'dispose()']
    ),
    node(
      'endpoint',
      ['Application', 'endpoint'],
      ['get · set · subscribe'],
      'external',
      box(760, 145, 245, 120),
      box(228, 460, 120, 130)
    ),
    node(
      'policy',
      ['Backend / policy'],
      ['HTTP · storage · socket', 'codec · retry · cache · durability'],
      'application',
      box(715, 340, 335, 100),
      box(228, 680, 120, 140),
      false,
      undefined,
      ['HTTP · storage', 'socket · codec', 'retry · cache', 'durability']
    ),
    node(
      'authority-door',
      ['inbound truth'],
      ['applied through external()'],
      'external',
      box(35, 340, 300, 100),
      box(12, 220, 120, 140),
      true,
      undefined,
      ['applied through', 'external()']
    ),
  ],
  edges: [
    edge('tree-link', 'tree-location', 'link-primitive', 'settled set'),
    edge(
      'link-endpoint',
      'link-primitive',
      'endpoint',
      'get · set · subscribe',
      {
        direction: 'both',
      }
    ),
    edge('endpoint-policy', 'endpoint', 'policy', 'implemented by'),
    edge('link-inbound', 'link-primitive', 'authority-door', 'classifies', {
      dashed: true,
    }),
    edge('inbound-tree', 'authority-door', 'tree-location', 'realizes', {
      dashed: true,
    }),
  ],
  checks: [
    'Link has exactly retrieve(), settled(), and dispose() on its handle.',
    'The endpoint interface supplies optional get(), set(), and subscribe() directions.',
    'Retry, backoff, status, codec, and transport are not kernel Link APIs.',
  ],
  evidence: [
    'packages/kernel/src/lib/link.ts',
    'packages/kernel/src/lib/link-bare-contract.spec.ts',
    'packages/kernel/src/lib/link-persistence-conformance.spec.ts',
  ],
};

export const EXPLANATION_PROJECTION_DIAGRAM: ArchitectureDiagramSpec = {
  id: 'explanation-projection',
  eyebrow: '08 · Explanation boundary',
  title: 'Explanation is a projection over causal truth',
  takeaway:
    'Human and AI narratives belong above compact causal facts, not inside retained turn metadata.',
  description:
    'The kernel retains the facts required by shipped causal and restoration behavior. Product-specific context can be combined with those stable identities to produce explanations without making prose part of state authority.',
  plainLanguage:
    'Keep small, reliable facts as truth. Turn those facts into friendly explanations only when a person or tool needs them.',
  realWorldExample:
    'An audit log keeps who changed an invoice and which fields changed. The UI can explain, “Mina corrected the quantity,” without storing that sentence as truth.',
  financialImpact:
    'Stable facts support audits and disputes. Generated wording can improve later without rewriting the financial record it explains.',
  desktopViewBox: '0 0 1040 500',
  mobileViewBox: '0 0 360 700',
  groups: [
    {
      id: 'projection-boundary',
      label: 'Product projection · not a public API',
      tone: 'projection',
      position: {
        desktop: box(330, 185, 680, 285),
        mobile: box(12, 165, 336, 515),
      },
      dashed: true,
    },
  ],
  nodes: [
    node(
      'causal-facts',
      ['Minimal', 'causal truth'],
      ['turns · participants · effects'],
      'kernel',
      box(30, 75, 280, 115),
      box(12, 20, 164, 105)
    ),
    node(
      'identities',
      ['Stable identities'],
      ['owner · position · subject'],
      'identity',
      box(30, 285, 280, 115),
      box(184, 20, 164, 105)
    ),
    node(
      'context',
      ['Application context'],
      ['domain metadata · user intent'],
      'application',
      box(380, 230, 260, 105),
      box(24, 205, 312, 105)
    ),
    node(
      'projection',
      ['Projection'],
      ['interprets; never becomes authority'],
      'projection',
      box(705, 230, 260, 105),
      box(24, 365, 312, 105)
    ),
    node(
      'human',
      ['Human', 'explanation'],
      ['product-facing narrative'],
      'authored',
      box(450, 375, 235, 80),
      box(12, 535, 164, 105)
    ),
    node(
      'ai',
      ['AI', 'explanation'],
      ['same facts · different projection'],
      'external',
      box(735, 375, 235, 80),
      box(184, 535, 164, 105),
      false,
      undefined,
      ['same facts', 'different projection']
    ),
  ],
  edges: [
    edge('facts-context', 'causal-facts', 'context'),
    edge('identities-context', 'identities', 'context'),
    edge('context-projection', 'context', 'projection'),
    edge('projection-human', 'projection', 'human'),
    edge('projection-ai', 'projection', 'ai'),
  ],
  checks: [
    'No shipped public API returns human or AI explanations.',
    'Narrative text is not retained causal authority.',
    'The projection boundary may add application context without changing kernel truth.',
  ],
  evidence: [
    'packages/kernel/src/lib/internals/causal-runtime/causal-types.ts',
    'packages/kernel/src/lib/audit/audit.ts',
    'RELEASE-1.0.md · AI-SEMANTIC-DISCOVERABILITY-0',
  ],
};
