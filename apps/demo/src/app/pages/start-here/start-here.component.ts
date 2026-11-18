import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

interface NextStepCard {
  audience: string;
  title: string;
  description: string;
  route: string;
  cta: string;
}

@Component({
  selector: 'app-start-here',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './start-here.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './start-here.component.scss',
})
export class StartHereComponent {
  readonly firstFeatureCode = `import { asReadonly, signalTree } from '@signal-tree/angular';

export function createEditor() {
  const tree = signalTree({ note: '', selectedId: null as number | null });
  return {
    state: asReadonly(tree).$,
    writeNote: (note: string) => tree.$.note.set(note),
    destroy: () => tree.destroy(),
  };
}

// Give this editor a component or session owner.
// The owner calls editor.destroy() when it closes.`;

  readonly nextSteps: NextStepCard[] = [
    {
      audience: 'I want to see the behavior',
      title: 'Review an overlapping proposal',
      description:
        'Keep independent work moving, inspect a proposal, and recover from a real refused rejection.',
      route: '/independent-publication',
      cta: 'Try review and recovery →',
    },
    {
      audience: 'I need the ordinary state model',
      title: 'Run the fundamentals',
      description:
        'Explore typed state, entity identity, external updates and optional capabilities.',
      route: '/examples/fundamentals',
      cta: 'Open fundamentals →',
    },
    {
      audience: 'I need a feature ownership pattern',
      title: 'Own state and operations together',
      description:
        'Use a scoped tutorial whose state is destroyed on navigation and starts fresh on return.',
      route: '/examples/fundamentals/recommended-architecture',
      cta: 'Open the owned example →',
    },
    {
      audience: 'I need exact APIs',
      title: 'Read package guidance',
      description:
        'Use the selected version’s installed declarations and its framework facade.',
      route: '/docs',
      cta: 'Open docs →',
    },
  ];
}
