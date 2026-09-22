import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExampleComponent } from './example.component';
import type {
  CodeFile,
  EmissionEntry,
  StackblitzConfig,
} from './example.types';
import { StackblitzService } from './stackblitz.service';

@Component({
  standalone: true,
  imports: [ExampleComponent],
  template: `
    <st-example
      heading="Counter"
      [headingLevel]="1"
      [code]="files()"
      [state]="state()"
      [emissions]="emissions()"
      [stackblitz]="stackblitz()"
    >
      <p intro>Change the counter and inspect its source.</p>
      <button class="increment" (click)="count.set(count() + 1)">+1</button>
      <output>{{ count() }}</output>
      <input aria-label="Draft" />
    </st-example>
  `,
})
class ExampleHostComponent {
  readonly count = signal(0);
  readonly state = signal<unknown>(undefined);
  readonly emissions = signal<EmissionEntry[] | null>(null);
  readonly files = signal<CodeFile[]>([
    {
      label: 'counter.ts',
      language: 'typescript',
      source: 'const count = signal(0);',
    },
  ]);
  readonly stackblitz = signal<StackblitzConfig | null>(null);
}

describe('ExampleComponent', () => {
  let fixture: ComponentFixture<ExampleHostComponent>;
  let element: HTMLElement;
  const openStackblitz = jest.fn();

  beforeEach(async () => {
    openStackblitz.mockReset();
    await TestBed.configureTestingModule({
      imports: [ExampleHostComponent],
      providers: [
        { provide: StackblitzService, useValue: { open: openStackblitz } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ExampleHostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  function query<T extends HTMLElement>(
    selector: string,
    root: ParentNode = element
  ): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Expected element matching ${selector}`);
    return found;
  }

  function toggle(): HTMLButtonElement {
    return query<HTMLButtonElement>('.st-example__toggle');
  }

  it('shows source by default and connects its toggle to the source region', () => {
    const source = query<HTMLElement>('.st-example__code');
    expect(source.hidden).toBe(false);
    expect(source.textContent).toContain('const count = signal(0);');
    expect(toggle().textContent).toContain('Hide code');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-controls')).toBe(source.id);
    expect(element.querySelector('h1')?.textContent).toBe('Counter');
    expect(element.querySelector('.st-example__intro')?.textContent).toContain(
      'Change the counter and inspect its source.'
    );
  });

  it('retains the live DOM, input drafts, and counter state when code is hidden and shown', () => {
    const live = query<HTMLElement>('.st-example__demo');
    const draft = query<HTMLInputElement>('input', live);
    const increment = query<HTMLButtonElement>('.increment', live);
    const source = query<HTMLElement>('.st-example__code');
    const viewer = source.querySelector('st-code-tabs');
    draft.value = 'unfinished input';
    increment.click();
    fixture.detectChanges();

    toggle().click();
    fixture.detectChanges();
    expect(source.hidden).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().textContent).toContain('Show code');
    expect(element.querySelector('.st-example__demo')).toBe(live);
    increment.click();
    fixture.detectChanges();

    toggle().click();
    fixture.detectChanges();
    expect(source.hidden).toBe(false);
    expect(source.querySelector('st-code-tabs')).toBe(viewer);
    expect(live.querySelector('input')).toBe(draft);
    expect(draft.value).toBe('unfinished input');
    expect(live.querySelector('output')?.textContent).toBe('2');
  });

  it('omits source controls and diagnostics when those inputs are absent', () => {
    fixture.componentInstance.files.set([]);
    fixture.detectChanges();
    expect(element.querySelector('.st-example__toggle')).toBeNull();
    expect(element.querySelector('.st-example__code')).toBeNull();
    expect(element.querySelector('details')).toBeNull();
    expect(element.querySelector('.increment')).not.toBeNull();
  });

  it('starts diagnostics collapsed and keeps state and emissions current when opened', () => {
    fixture.componentInstance.state.set({ count: 1 });
    fixture.componentInstance.emissions.set([]);
    fixture.detectChanges();
    const diagnostics = query<HTMLDetailsElement>('details');
    expect(diagnostics.open).toBe(false);
    expect(diagnostics.querySelector('summary')?.textContent).toContain(
      'State and emissions'
    );
    expect(diagnostics.querySelector('st-emission-log')?.textContent).toContain(
      'Interact with the demo to see emissions.'
    );

    query<HTMLElement>('summary', diagnostics).click();
    fixture.componentInstance.state.set({ count: 2 });
    fixture.componentInstance.emissions.set([
      { label: 'count', value: '2', seq: 1 },
    ]);
    fixture.detectChanges();
    expect(diagnostics.open).toBe(true);
    expect(
      diagnostics.querySelector('st-state-inspector')?.textContent
    ).toContain('"count": 2');
    expect(diagnostics.querySelector('st-emission-log')?.textContent).toContain(
      'count'
    );
    expect(diagnostics.querySelector('st-emission-log')?.textContent).toContain(
      '2'
    );
  });

  it('keeps optional StackBlitz access available while source is hidden', () => {
    const config: StackblitzConfig = { title: 'Counter', files: {} };
    fixture.componentInstance.stackblitz.set(config);
    fixture.detectChanges();
    toggle().click();
    fixture.detectChanges();
    query<HTMLButtonElement>('.st-example__edit').click();
    expect(openStackblitz).toHaveBeenCalledWith(config);
  });

  it('assigns separate source regions when multiple examples share a page', () => {
    const second = TestBed.createComponent(ExampleHostComponent);
    second.detectChanges();
    const secondToggle: HTMLButtonElement = second.nativeElement.querySelector(
      '.st-example__toggle'
    );
    expect(secondToggle.getAttribute('aria-controls')).not.toBe(
      toggle().getAttribute('aria-controls')
    );
    second.destroy();
  });
});
