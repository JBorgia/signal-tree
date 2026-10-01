import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { external } from '@signal-tree/angular';
import { OwnedSessionsComponent } from './owned-sessions.component';
import {
  createDeviceSession,
  createDocumentTree,
  createEditorSession,
  type EditorSession,
} from './owned-sessions.model';

describe('independently owned editor sessions', () => {
  let canonical: ReturnType<typeof createDocumentTree>;
  let editors: EditorSession[];
  const open = (id: string) => {
    const editor = createEditorSession(id, canonical, 'order-1');
    editors.push(editor);
    return editor;
  };
  beforeEach(() => {
    canonical = createDocumentTree();
    editors = [];
  });
  afterEach(() => {
    editors.forEach((editor) => editor.destroy());
    canonical.destroy();
  });

  it('gives two editors of the same record independent drafts and disposal', () => {
    const first = open('first');
    const second = open('second');
    first.draft.$.title.set('Unsaved');
    expect(second.draft.$.title()).toBe('Inspect delivery');
    expect(canonical.$.documents.byId('order-1')?.title()).toBe(
      'Inspect delivery'
    );
    first.destroy();
    expect(first.draft.destroyed()).toBe(true);
    expect(first.apply()).toBe('closed');
    expect(second.draft.destroyed()).toBe(false);
    second.draft.$.title.set('Second edit');
    expect(second.apply()).toBe('applied');
    expect(canonical.$.documents.byId('order-1')?.title()).toBe('Second edit');
  });

  it('refuses an older draft after another editor saves without losing the draft', () => {
    const first = open('first');
    const second = open('second');
    first.draft.$.title.set('First edit');
    second.draft.$.title.set('Second edit');
    expect(first.apply()).toBe('applied');
    expect(second.apply()).toBe('changed');
    expect(second.draft.$.title()).toBe('Second edit');
    expect(canonical.$.documents.byId('order-1')?.title()).toBe('First edit');
    expect(second.reload()).toBe(true);
    second.draft.$.title.set('Reviewed edit');
    expect(second.apply()).toBe('applied');
    expect(canonical.$.documents.byId('order-1')?.revision()).toBe(3);
  });

  it('requires an explicit reload after external truth changes', () => {
    const editor = open('first');
    editor.draft.$.title.set('Local draft');
    external(() =>
      canonical.$.documents.updateOne('order-1', {
        title: 'Server',
        revision: 2,
      })
    );
    expect(editor.apply()).toBe('changed');
    expect(editor.draft.$.title()).toBe('Local draft');
    expect(canonical.$.documents.byId('order-1')?.title()).toBe('Server');
    expect(editor.reload()).toBe(true);
    expect(editor.draft.$.title()).toBe('Server');
  });

  it('does not retarget an old draft when a business ID and revision are reused', () => {
    const editor = open('first');
    canonical.$.documents.removeOne('order-1');
    expect(editor.apply()).toBe('missing');
    canonical.$.documents.addOne({
      id: 'order-1',
      lifetime: 2,
      revision: 1,
      title: 'Replacement',
    });
    expect(editor.apply()).toBe('replaced');
    expect(editor.reload()).toBe(false);
    expect(canonical.$.documents.byId('order-1')?.title()).toBe('Replacement');
  });

  it('rejects invalid input without changing current data', () => {
    const editor = open('first');
    const before = canonical.$.documents.byId('order-1')?.();
    editor.draft.$.title.set('  ');
    expect(editor.apply()).toBe('invalid');
    expect(canonical.$.documents.byId('order-1')?.()).toEqual(before);
  });
});

describe('independently owned device sessions', () => {
  it('releases one subscription exactly once and ignores an in-flight callback', () => {
    let receiveFirst!: (value: number) => void;
    let receiveSecond!: (value: number) => void;
    const stopFirst = jest.fn();
    const stopSecond = jest.fn();
    const first = createDeviceSession('first', (receive) => {
      receiveFirst = receive;
      return stopFirst;
    });
    const second = createDeviceSession('second', (receive) => {
      receiveSecond = receive;
      return stopSecond;
    });
    const total = computed(
      () => first.tree.$.received() + second.tree.$.received()
    );
    try {
      receiveFirst(5);
      receiveSecond(6);
      expect(total()).toBe(2);
      first.destroy();
      first.destroy();
      const firstCount = first.tree.$.received();
      receiveFirst(7);
      receiveSecond(8);
      expect(first.tree.$.received()).toBe(firstCount);
      expect(second.tree.$.received()).toBe(2);
      expect(stopFirst).toHaveBeenCalledTimes(1);
      expect(stopSecond).not.toHaveBeenCalled();
    } finally {
      first.destroy();
      second.destroy();
    }
    expect(stopSecond).toHaveBeenCalledTimes(1);
  });

  it('destroys all owned trees and timers when the component is destroyed', async () => {
    jest.useFakeTimers();
    try {
      await TestBed.configureTestingModule({
        imports: [OwnedSessionsComponent],
        providers: [provideRouter([])],
      }).compileComponents();
      const fixture = TestBed.createComponent(OwnedSessionsComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      component.openEditor();
      component.openEditor();
      component.startDevice();
      component.startDevice();
      jest.advanceTimersByTime(2000);
      expect(component.received()).toBe(4);
      const first = component.devices()[0];
      component.stopDevice(first);
      jest.advanceTimersByTime(1000);
      expect(component.received()).toBe(3);
      const editors = component.editors();
      const remaining = component.devices()[0];
      fixture.destroy();
      expect(component.canonical.destroyed()).toBe(true);
      expect(editors.every((editor) => editor.draft.destroyed())).toBe(true);
      expect(remaining.tree.destroyed()).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
