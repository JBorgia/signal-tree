import {
  currentObservedResponsibility,
  explainValue,
  type CapturedValue,
  type EpistemicClass,
  type EvidenceSet,
  type ExplanationClaim,
} from '@signal-tree/studio-query';

/**
 * The "Why is this value here?" panel body.
 *
 *     THE UI RENDERS CLAIMS. IT DOES NOT INFER THEM.
 *
 * ⚠️ Every line's epistemic class comes from `studio-query`, never from this
 * layer. A panel that decided for itself which statements were facts would be
 * free to draw the causal arrow SUPERSESSION-0 forbade — so the classification
 * and the evidence reference travel together, and rendering is a pure mapping.
 */

export interface WhyLine {
  readonly classification: EpistemicClass;
  readonly text: string;
  /** The exact records supporting this line. Empty for UNKNOWN. */
  readonly evidence: readonly string[];
}

export interface WhyView {
  readonly path: string;
  readonly currentValue: string;
  /** `false` when the live value diverges from retained evidence. */
  readonly currentValueExplained: boolean;
  readonly lines: readonly WhyLine[];
}

const render = (v: unknown): string => {
  const captured = v as CapturedValue | undefined;
  if (captured && typeof captured === 'object' && 'kind' in captured) {
    return captured.kind === 'value'
      ? JSON.stringify(captured.value)
      : `<${captured.valueType}: ${captured.preview}>`;
  }
  return JSON.stringify(v);
};

/** One claim code → one sentence. No branching on anything else. */
function sentence(claim: ExplanationClaim): string {
  const d = claim.data;
  switch (claim.code) {
    case 'TRANSACTION_COMMITTED_VALUE':
      return `T${String(d['turnId'])} committed ${render(d['after'])}.`;
    case 'REALIZATION_CHANGED_VALUE': {
      const origin = d['origin'] ? String(d['origin']) : 'external';
      return `${origin === 'external' ? 'External realization' : `A ${origin} write`} changed ${render(d['before'])} → ${render(d['after'])}.`;
    }
    case 'VALUE_SUPERSEDED_PREDECESSOR':
      return `${render(d['current'])} superseded the previously visible ${render(d['superseded'])}.`;
    case 'AUTHORING_CAUSE_UNKNOWN':
      return 'No retained evidence identifies which authored operation caused the realization.';
    case 'COVERAGE_LIMIT':
      return coverageSentence(String(d['reason']));
    default:
      return claim.code;
  }
}

/** Coverage limits are stated, never footnoted — absence is not evidence. */
function coverageSentence(reason: string): string {
  switch (reason) {
    case 'capture-started-late':
      return 'Capture began after application startup; nothing is known before that point.';
    case 'history-truncated':
      return 'Earlier captured evidence has been evicted; this history is bounded.';
    case 'scope-incomplete':
      return 'Some observed writes could not be safely assigned to this tree.';
    default:
      return `Coverage limit: ${reason}.`;
  }
}

export function whyValue(
  set: EvidenceSet,
  path: string,
  currentValue: CapturedValue
): WhyView {
  const responsibility = currentObservedResponsibility(set, path, currentValue).value;

  return {
    path,
    currentValue: render(currentValue),
    // When the live value diverges, the panel must not present the retained
    // history as explaining what is on screen.
    currentValueExplained: responsibility.source.kind !== 'unknown',
    lines: explainValue(set, path).value.map((claim) => ({
      classification: claim.classification,
      text: sentence(claim),
      evidence: claim.evidence,
    })),
  };
}

/** Plain-text rendering — the panel body, and what the demo shows. */
export function formatWhy(view: WhyView): string {
  const head = [
    `${view.path}`,
    `Current value: ${view.currentValue}`,
    ...(view.currentValueExplained
      ? []
      : ['⚠ The current value is not explained by retained evidence.']),
    '',
    'WHY?',
    '',
  ];
  const body = view.lines.map(
    (l) =>
      `${l.classification.toUpperCase().padEnd(8)} ${l.text}` +
      (l.evidence.length ? `   [${l.evidence.join(', ')}]` : '')
  );
  return [...head, ...body].join('\n');
}
