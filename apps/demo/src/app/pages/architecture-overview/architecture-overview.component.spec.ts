import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchitectureOverviewComponent } from './architecture-overview.component';

const renderedText = (
  fixture: ComponentFixture<ArchitectureOverviewComponent>
): string =>
  (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ').trim();

describe('ArchitectureOverviewComponent', () => {
  let fixture: ComponentFixture<ArchitectureOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchitectureOverviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ArchitectureOverviewComponent);
    fixture.detectChanges();
  });

  it('renders the verified v15 architecture story', () => {
    const text = renderedText(fixture);

    expect(text).toContain('SignalTree v15 architecture');
    expect(text).toContain('@signal-tree/kernel');
    expect(text).toContain('@signal-tree/angular');
    expect(text).toContain('@signal-tree/react');
    expect(text).toContain('Authored');
    expect(text).toContain('External');
    expect(text).toContain('Restoration designation');
    expect(text).toContain('Orthogonal operation boundary');
  });

  it('shows the actual root, branch, and leaf write grammars', () => {
    const text = renderedText(fixture);

    expect(text).toContain('tree.$(next)');
    expect(text).toContain('tree.$(current => next)');
    expect(text).toContain('tree.$.profile(next)');
    expect(text).toContain('location() / location(next)');
    expect(text).toContain('location(current => next)');
    expect(text).toContain('location(leaf(callback))');
  });

  it('does not repeat superseded or unsupported marketing claims', () => {
    const text = renderedText(fixture);

    expect(text).not.toContain('single package');
    expect(text).not.toContain('8.5KB');
    expect(text).not.toContain('76%');
    expect(text).not.toContain('No selectors');
  });

  it('renders each architecture diagram as an accessible SVG figure', () => {
    const figures = fixture.nativeElement.querySelectorAll(
      'figure[data-architecture-diagram]'
    );

    expect(figures).toHaveLength(8);
    for (const figure of figures) {
      const variants = figure.querySelectorAll('svg');
      expect(variants).toHaveLength(2);

      for (const svg of variants) {
        const labelledBy =
          svg.getAttribute('aria-labelledby')?.trim().split(/\s+/) ?? [];
        const title = svg.querySelector('title');
        const description = svg.querySelector('desc');

        expect(svg.getAttribute('role')).toBe('img');
        expect(labelledBy).toHaveLength(2);
        expect(title?.getAttribute('id')).toBe(labelledBy[0]);
        expect(description?.getAttribute('id')).toBe(labelledBy[1]);
        expect(title?.textContent?.trim()).toBeTruthy();
        expect(description?.textContent?.trim()).toBeTruthy();
      }

      expect(figure.querySelectorAll('.diagram-node[tabindex]')).toHaveLength(
        0
      );
    }
  });

  it('wraps every connector label onto an explicit backing plate', () => {
    const labelGroups = Array.from(
      fixture.nativeElement.querySelectorAll('.edge-label-group')
    ) as SVGGElement[];

    expect(labelGroups.length).toBeGreaterThan(0);
    for (const group of labelGroups) {
      const plate = group.querySelector('.edge-label-plate');

      expect(Number(plate?.getAttribute('width'))).toBeGreaterThanOrEqual(84);
      expect(Number(plate?.getAttribute('height'))).toBeGreaterThanOrEqual(23);
    }

    const wrappedLabels = labelGroups.filter(
      (group) => group.querySelectorAll('.edge-label tspan').length > 1
    );
    expect(wrappedLabels.length).toBeGreaterThanOrEqual(4);
  });
});
