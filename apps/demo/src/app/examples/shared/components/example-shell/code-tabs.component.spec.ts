import { TestBed } from '@angular/core/testing';
import { CodeTabsComponent } from './code-tabs.component';

const files = [
  {
    label: 'component.ts',
    language: 'typescript' as const,
    source: 'const count = 1;',
  },
  {
    label: 'template.html',
    language: 'html' as const,
    source: '<button>Update</button>',
  },
];

const setup = () => {
  const fixture = TestBed.createComponent(CodeTabsComponent);
  fixture.componentRef.setInput('files', files);
  fixture.detectChanges();
  return fixture;
};

describe('CodeTabsComponent', () => {
  it('supports roving keyboard focus, wraparound, Home and End with associated source', () => {
    const fixture = setup();
    const element: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(
      element.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );
    const press = (index: number, key: string, expected: number) => {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      tabs[index].dispatchEvent(event);
      fixture.detectChanges();
      expect(event.defaultPrevented).toBe(true);
      expect(tabs.map((tab) => tab.tabIndex)).toEqual(
        expected === 0 ? [0, -1] : [-1, 0]
      );
      expect(tabs[expected].getAttribute('aria-selected')).toBe('true');
      const panel = element.querySelector('[role="tabpanel"]');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tabs[expected].id);
      expect(panel?.id).toBe(tabs[expected].getAttribute('aria-controls'));
      expect(element.querySelector('code')?.textContent).toBe(
        files[expected].source
      );
    };
    press(0, 'ArrowRight', 1);
    press(1, 'ArrowRight', 0);
    press(0, 'ArrowLeft', 1);
    press(1, 'Home', 0);
    press(0, 'End', 1);
    fixture.destroy();
  });

  it('copies the selected raw source and reports unavailable clipboard access', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const fixture = setup();
    try {
      fixture.componentInstance.select(1);
      await fixture.componentInstance.copy();
      fixture.detectChanges();
      expect(writeText).toHaveBeenCalledWith(files[1].source);
      expect(
        fixture.nativeElement.querySelector('[role="status"]').textContent
      ).toBe('template.html copied.');
      fixture.componentInstance.select(0);
      writeText.mockRejectedValueOnce(new Error('denied'));
      await fixture.componentInstance.copy();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[role="status"]').textContent
      ).toContain('Copy unavailable');
      expect(fixture.componentInstance.copied()).toBe(false);
    } finally {
      fixture.destroy();
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('uses unique panel identities and keeps selection valid when files change', () => {
    const first = setup();
    const second = setup();
    expect(first.componentInstance.id).not.toBe(second.componentInstance.id);
    first.componentInstance.select(1);
    first.componentRef.setInput('files', [files[0]]);
    first.detectChanges();
    expect(first.nativeElement.querySelector('code').textContent).toBe(
      files[0].source
    );
    expect(
      first.nativeElement
        .querySelector('[role="region"]')
        .getAttribute('aria-label')
    ).toBe(files[0].label);
    first.destroy();
    second.destroy();
  });
});
