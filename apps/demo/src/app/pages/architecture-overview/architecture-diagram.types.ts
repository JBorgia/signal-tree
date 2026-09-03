export type ArchitectureDiagramTone =
  | 'application'
  | 'framework'
  | 'kernel'
  | 'authored'
  | 'external'
  | 'restoration'
  | 'identity'
  | 'projection'
  | 'neutral';

export interface DiagramBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ResponsiveDiagramBox {
  readonly desktop: DiagramBox;
  readonly mobile: DiagramBox;
}

export interface ArchitectureDiagramNode {
  readonly id: string;
  readonly title: readonly string[];
  readonly detail?: readonly string[];
  readonly mobileTitle?: readonly string[];
  readonly mobileDetail?: readonly string[];
  readonly tone: ArchitectureDiagramTone;
  readonly position: ResponsiveDiagramBox;
  readonly code?: boolean;
}

export interface ArchitectureDiagramEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly tone?: ArchitectureDiagramTone;
  readonly direction?: 'forward' | 'both' | 'none';
  readonly dashed?: boolean;
  readonly labelOffset?: {
    readonly desktop?: readonly [number, number];
    readonly mobile?: readonly [number, number];
  };
}

export interface ArchitectureDiagramGroup {
  readonly id: string;
  readonly label: string;
  readonly tone: ArchitectureDiagramTone;
  readonly position: ResponsiveDiagramBox;
  readonly dashed?: boolean;
}

export interface ArchitectureDiagramSpec {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly takeaway: string;
  readonly description: string;
  readonly desktopViewBox: string;
  readonly mobileViewBox: string;
  readonly nodes: readonly ArchitectureDiagramNode[];
  readonly edges: readonly ArchitectureDiagramEdge[];
  readonly groups?: readonly ArchitectureDiagramGroup[];
  readonly checks: readonly string[];
  readonly evidence: readonly string[];
}
