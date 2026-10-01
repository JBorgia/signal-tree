import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  input,
  runInInjectionContext,
  signal,
  type OnInit,
  type Signal,
} from '@angular/core';
import {
  EDITOR_FIELDS,
  type EditorField,
  type EditorStore,
  type Line,
  type EditorSeed,
} from '../contract';
import { ARM } from './tokens';
import { EditorRegistry } from './editor-registry';
import { tickEditor } from './counters';

/** One editable order line. The line signal is obtained once per instance. */
@Component({
  selector: 'bench-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let l = line(); @if (l) {
    <div class="line" [attr.data-line]="l.id" [attr.data-t]="tick()">
      <span>{{ l.id }}</span> <span data-f="product">{{ l.product }}</span>
      <span data-f="qty">{{ l.qty }}</span>
      <span data-f="price">{{ l.price }}</span>
    </div>
    }
  `,
})
export class LineComponent implements OnInit {
  readonly editor = input.required<EditorStore>();
  readonly lineId = input.required<string>();
  protected line: Signal<Line | undefined> = signal(undefined);
  protected readonly tick = tickEditor;

  ngOnInit(): void {
    this.line = this.editor().line(this.lineId());
  }
}

interface FieldView {
  readonly key: EditorField;
  readonly sig: Signal<string | number>;
}

/** A stacked editor: owns an EditorStore created in its injection context. */
@Component({
  selector: 'bench-editor',
  imports: [LineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="editor"
      [attr.data-editor]="seed().rowId"
      [attr.data-t]="tick()"
    >
      @for (f of fields; track f.key) {
      <label>
        {{ f.key }}
        <input
          [attr.data-field]="f.key"
          [value]="f.sig()"
          (input)="onInput(f.key, $event)"
        />
      </label>
      } @for (id of lineIds(); track id) {
      <bench-line [editor]="store" [lineId]="id" />
      }
      <div data-total>{{ total() }}</div>
      <div data-dirty>{{ dirty() }}</div>
    </section>
  `,
})
export class EditorComponent implements OnInit {
  readonly seed = input.required<EditorSeed>();
  readonly editorKey = input.required<number>();
  private readonly registry = inject(EditorRegistry);
  private readonly arm = inject(ARM);
  private readonly injector = inject(Injector);

  protected store!: EditorStore;
  protected fields: readonly FieldView[] = [];
  protected lineIds!: Signal<readonly string[]>;
  protected total!: Signal<number>;
  protected dirty!: Signal<boolean>;
  protected readonly tick = tickEditor;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.registry.stores.delete(this.editorKey());
      this.store.destroy();
    });
  }

  ngOnInit(): void {
    // Inputs are only available from ngOnInit, so re-enter this component's own injection
    // context for the arm's createEditor (it may inject() / use DestroyRef).
    const seed = this.seed();
    this.store = runInInjectionContext(this.injector, () =>
      this.arm.createEditor(seed)
    );
    this.registry.stores.set(this.editorKey(), this.store);
    this.fields = EDITOR_FIELDS.map((key) => ({
      key,
      sig: this.store.field(key) as Signal<string | number>,
    }));
    this.lineIds = this.store.lineIds;
    this.total = this.store.total;
    this.dirty = this.store.dirty;
  }

  protected onInput(key: EditorField, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const numeric = key === 'qty' || key === 'eta';
    (this.store as { set(k: EditorField, v: unknown): void }).set(
      key,
      numeric ? Number(raw) : raw
    );
  }
}
