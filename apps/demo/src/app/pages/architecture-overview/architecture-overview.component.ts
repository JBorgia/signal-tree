import { Component, ChangeDetectionStrategy } from '@angular/core';

import { ArchitectureDiagramComponent } from './architecture-diagram.component';
import {
  ACCESSOR_GRAMMAR_DIAGRAM,
  CAUSAL_AUTHORITY_DIAGRAM,
  COHERENT_OPERATION_DIAGRAM,
  ENTITY_IDENTITY_DIAGRAM,
  EXPLANATION_PROJECTION_DIAGRAM,
  LINK_DIAGRAM,
  PACKAGE_OWNERSHIP_DIAGRAM,
  SYSTEM_BOUNDARY_DIAGRAM,
} from './architecture-diagrams';

@Component({
  selector: 'app-architecture-overview',
  standalone: true,
  imports: [ArchitectureDiagramComponent],
  templateUrl: './architecture-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './architecture-overview.component.scss',
})
export class ArchitectureOverviewComponent {
  readonly boundary = SYSTEM_BOUNDARY_DIAGRAM;
  readonly foundations = [
    PACKAGE_OWNERSHIP_DIAGRAM,
    ACCESSOR_GRAMMAR_DIAGRAM,
  ] as const;
  readonly causality = [
    CAUSAL_AUTHORITY_DIAGRAM,
    COHERENT_OPERATION_DIAGRAM,
  ] as const;
  readonly continuity = [ENTITY_IDENTITY_DIAGRAM, LINK_DIAGRAM] as const;
  readonly projection = EXPLANATION_PROJECTION_DIAGRAM;
}
