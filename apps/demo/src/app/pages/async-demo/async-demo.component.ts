
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-async-demo',
  standalone: true,
  imports: [],
  templateUrl: './async-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './async-demo.component.scss',
})
export class AsyncDemoComponent {}
