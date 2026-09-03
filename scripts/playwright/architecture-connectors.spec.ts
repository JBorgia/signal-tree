import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

interface DiagramLabelAudit {
  readonly diagram: string;
  readonly hiddenByLayerOrder: readonly string[];
  readonly nodeIntersections: readonly string[];
  readonly plateMisses: readonly string[];
  readonly viewportEscapes: readonly string[];
}

for (const viewport of VIEWPORTS) {
  test(`architecture connector labels remain visible at ${viewport.name} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/architecture-overview', { waitUntil: 'load' });
    await expect(page.locator('figure[data-architecture-diagram]').first()).toBeVisible();

    const audits = await page.evaluate<DiagramLabelAudit[]>(() => {
      const intersects = (left: DOMRect, right: DOMRect): boolean =>
        left.left < right.right &&
        left.right > right.left &&
        left.top < right.bottom &&
        left.bottom > right.top;
      const contains = (outer: DOMRect, inner: DOMRect): boolean =>
        inner.left >= outer.left - 1 &&
        inner.right <= outer.right + 1 &&
        inner.top >= outer.top - 1 &&
        inner.bottom <= outer.bottom + 1;

      return Array.from(
        document.querySelectorAll<HTMLElement>(
          'figure[data-architecture-diagram]'
        )
      ).map((figure) => {
        const svg = Array.from(figure.querySelectorAll<SVGSVGElement>('svg')).find(
          (candidate) => getComputedStyle(candidate).display !== 'none'
        );
        if (!svg) throw new Error('No visible diagram variant');

        const labels = Array.from(
          svg.querySelectorAll<SVGGElement>('.edge-label-group')
        );
        const nodes = Array.from(
          svg.querySelectorAll<SVGGElement>('.diagram-node')
        );
        const svgBox = svg.getBoundingClientRect();
        const lastNode = nodes.at(-1);

        return {
          diagram: figure.dataset['architectureDiagram'] ?? 'unknown',
          hiddenByLayerOrder: labels
            .filter(
              (label) =>
                !!lastNode &&
                Boolean(
                  label.compareDocumentPosition(lastNode) &
                    Node.DOCUMENT_POSITION_FOLLOWING
                )
            )
            .map((label) => label.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
          nodeIntersections: labels.flatMap((label) => {
            const labelBox = label.getBoundingClientRect();
            return nodes
              .filter((node) => intersects(labelBox, node.getBoundingClientRect()))
              .map(
                (node) =>
                  `${label.textContent?.replace(/\s+/g, ' ').trim()} -> ${
                    node.textContent?.replace(/\s+/g, ' ').trim()
                  }`
              );
          }),
          plateMisses: labels
            .filter((label) => {
              const plate = label.querySelector<SVGRectElement>(
                '.edge-label-plate'
              );
              const text = label.querySelector<SVGTextElement>('.edge-label');
              return (
                !plate ||
                !text ||
                !contains(plate.getBoundingClientRect(), text.getBoundingClientRect())
              );
            })
            .map((label) => label.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
          viewportEscapes: labels
            .filter((label) => !contains(svgBox, label.getBoundingClientRect()))
            .map((label) => label.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
        };
      });
    });

    for (const audit of audits) {
      expect(
        audit.hiddenByLayerOrder,
        `${audit.diagram}: connector labels render below nodes`
      ).toEqual([]);
      expect(
        audit.nodeIntersections,
        `${audit.diagram}: connector labels overlap nodes`
      ).toEqual([]);
      expect(
        audit.plateMisses,
        `${audit.diagram}: connector text escapes its backing plate`
      ).toEqual([]);
      expect(
        audit.viewportEscapes,
        `${audit.diagram}: connector labels escape the SVG viewport`
      ).toEqual([]);
    }
  });
}
