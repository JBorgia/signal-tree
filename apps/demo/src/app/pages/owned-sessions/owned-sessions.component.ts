import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { external } from '@signal-tree/angular';
import {
  createDeviceSession,
  createDocumentTree,
  createEditorSession,
  type DeviceSession,
  type EditorSession,
} from './owned-sessions.model';

@Component({
  selector: 'app-owned-sessions',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './owned-sessions.component.html',
  styleUrl: './owned-sessions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnedSessionsComponent {
  readonly canonical = createDocumentTree();
  readonly editors = signal<readonly EditorSession[]>([]);
  readonly devices = signal<readonly DeviceSession[]>([]);
  readonly document = computed(() =>
    this.canonical.$.documents.byId('order-1')?.()
  );
  readonly received = computed(() =>
    this.devices().reduce(
      (total, session) => total + session.tree.$.received(),
      0
    )
  );
  private nextEditor = 0;
  private nextDevice = 0;
  private nextLifetime = 1;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const editor of this.editors()) editor.destroy();
      for (const device of this.devices()) device.destroy();
      this.canonical.destroy();
    });
  }

  openEditor(): void {
    if (!this.document()) return;
    const editor = createEditorSession(
      `Editor ${++this.nextEditor}`,
      this.canonical,
      'order-1'
    );
    this.editors.update((editors) => [...editors, editor]);
  }
  closeEditor(editor: EditorSession): void {
    editor.destroy();
    this.editors.update((editors) => editors.filter((item) => item !== editor));
  }
  apply(editor: EditorSession): void {
    const result = editor.apply();
    if (result === 'applied') {
      this.closeEditor(editor);
      return;
    }
    const messages = {
      changed:
        'Current data changed. Review it, then explicitly reload or discard this draft.',
      replaced:
        'This record was replaced. Close this editor and open a new one.',
      missing:
        'This record was removed. The draft remains available to read or discard.',
      invalid: 'Enter a non-empty title.',
      closed: 'This session is closed.',
    };
    editor.notice.set(messages[result]);
  }
  reload(editor: EditorSession): void {
    if (!editor.reload())
      editor.notice.set(
        'Cannot reload this record. Close the editor and open a new one.'
      );
  }
  serverUpdate(): void {
    const current = this.document();
    if (!current) return;
    external(() =>
      this.canonical.$.documents.updateOne(current.id, {
        title: `Server update ${current.revision + 1}`,
        revision: current.revision + 1,
      })
    );
  }
  replaceDocument(): void {
    external(() => {
      this.canonical.$.documents.removeOne('order-1');
      this.canonical.$.documents.addOne({
        id: 'order-1',
        lifetime: ++this.nextLifetime,
        revision: 1,
        title: 'Replacement record',
      });
    });
  }
  startDevice(): void {
    const id = `Device ${++this.nextDevice}`;
    const session = createDeviceSession(id, (receive) => {
      let sample = 0;
      const timer = setInterval(() => receive(++sample), 1000);
      return () => clearInterval(timer);
    });
    this.devices.update((devices) => [...devices, session]);
  }
  stopDevice(device: DeviceSession): void {
    device.destroy();
    this.devices.update((devices) => devices.filter((item) => item !== device));
  }
}
