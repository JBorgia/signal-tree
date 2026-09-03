import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type {
  ArchitectureDiagramEdge,
  ArchitectureDiagramNode,
  ArchitectureDiagramSpec,
  DiagramBox,
} from './architecture-diagram.types';

interface RenderedDiagramEdge extends ArchitectureDiagramEdge {
  readonly path: string;
  readonly labelX: number;
  readonly labelY: number;
  readonly labelLines: readonly string[];
  readonly labelLineHeight: number;
  readonly labelPlateX: number;
  readonly labelPlateY: number;
  readonly labelWidth: number;
  readonly labelHeight: number;
}

interface RenderedDiagramNode extends ArchitectureDiagramNode, DiagramBox {
  readonly centerX: number;
  readonly titleY: number;
  readonly detailY: number;
}

interface RenderedDiagram {
  readonly nodes: readonly RenderedDiagramNode[];
  readonly edges: readonly RenderedDiagramEdge[];
}

const wrapWords = (text: string, maxCharacters: number): string[] => {
  const lines: string[] = [];
  let currentLine = '';

  for (const word of text.split(/\s+/)) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && candidate.length > maxCharacters) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
};

const layoutEdgeLabel = (
  label: string | undefined,
  centerX: number,
  centerY: number,
  viewport: 'desktop' | 'mobile'
) => {
  const fontSize = viewport === 'mobile' ? 10 : 11;
  const lineHeight = viewport === 'mobile' ? 13 : 14;
  const maxCharacters = viewport === 'mobile' ? 18 : 24;
  const lines = label
    ? label
        .split(/\s+·\s+/)
        .flatMap((part) => wrapWords(part, maxCharacters))
    : [];
  const longestLine = Math.max(0, ...lines.map((line) => line.length));
  const width = lines.length
    ? Math.max(84, Math.ceil(longestLine * fontSize * 0.62 + 18))
    : 0;
  const height = lines.length * lineHeight + (lines.length ? 10 : 0);
  const firstBaselineY =
    centerY - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34;

  return {
    labelLines: lines,
    labelLineHeight: lineHeight,
    labelPlateX: centerX - width / 2,
    labelPlateY: centerY - height / 2,
    labelWidth: width,
    labelHeight: height,
    labelY: firstBaselineY,
  };
};

const connect = (
  from: DiagramBox,
  to: DiagramBox
): { path: string; midpoint: readonly [number, number] } => {
  const fromCenterX = from.x + from.width / 2;
  const fromCenterY = from.y + from.height / 2;
  const toCenterX = to.x + to.width / 2;
  const toCenterY = to.y + to.height / 2;
  const deltaX = toCenterX - fromCenterX;
  const deltaY = toCenterY - fromCenterY;
  const fromScale = Math.min(
    Math.abs(deltaX) > 0 ? from.width / 2 / Math.abs(deltaX) : Infinity,
    Math.abs(deltaY) > 0 ? from.height / 2 / Math.abs(deltaY) : Infinity
  );
  const toScale = Math.min(
    Math.abs(deltaX) > 0 ? to.width / 2 / Math.abs(deltaX) : Infinity,
    Math.abs(deltaY) > 0 ? to.height / 2 / Math.abs(deltaY) : Infinity
  );
  const startX = fromCenterX + deltaX * fromScale;
  const startY = fromCenterY + deltaY * fromScale;
  const endX = toCenterX - deltaX * toScale;
  const endY = toCenterY - deltaY * toScale;

  return {
    path: `M ${startX} ${startY} L ${endX} ${endY}`,
    midpoint: [(startX + endX) / 2, (startY + endY) / 2],
  };
};

const renderDiagram = (
  diagram: ArchitectureDiagramSpec,
  viewport: 'desktop' | 'mobile'
): RenderedDiagram => {
  const nodes = diagram.nodes.map((source): RenderedDiagramNode => {
    const position = source.position[viewport];
    const title =
      viewport === 'mobile' ? source.mobileTitle ?? source.title : source.title;
    const detail =
      viewport === 'mobile'
        ? source.mobileDetail ?? source.detail
        : source.detail;
    const titleHeight = title.length * 22;
    const detailHeight = (detail?.length ?? 0) * 18;
    const contentHeight = titleHeight + (detailHeight ? detailHeight + 8 : 0);
    const titleY = position.y + (position.height - contentHeight) / 2 + 17;

    return {
      ...source,
      title,
      detail,
      ...position,
      centerX: position.x + position.width / 2,
      titleY,
      detailY: titleY + titleHeight + 3,
    };
  });
  const nodesById = new Map(nodes.map((current) => [current.id, current]));
  const edges = diagram.edges.map((source): RenderedDiagramEdge => {
    const from = nodesById.get(source.from);
    const to = nodesById.get(source.to);
    if (!from || !to) {
      throw new Error(`Unknown diagram edge: ${source.from} -> ${source.to}`);
    }

    const connection = connect(from, to);
    const [offsetX = 0, offsetY = -8] = source.labelOffset?.[viewport] ?? [];
    const labelX = connection.midpoint[0] + offsetX;
    const labelCenterY = connection.midpoint[1] + offsetY;

    return {
      ...source,
      path: connection.path,
      labelX,
      ...layoutEdgeLabel(source.label, labelX, labelCenterY, viewport),
    };
  });

  return { nodes, edges };
};

@Component({
  selector: 'app-architecture-diagram',
  standalone: true,
  templateUrl: './architecture-diagram.component.html',
  styleUrl: './architecture-diagram.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchitectureDiagramComponent {
  readonly diagram = input.required<ArchitectureDiagramSpec>();
  readonly desktop = computed(() => renderDiagram(this.diagram(), 'desktop'));
  readonly mobile = computed(() => renderDiagram(this.diagram(), 'mobile'));
}
