import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-stored-versioning-demo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './stored-versioning-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './stored-versioning-demo.component.scss',
})
export class StoredVersioningDemoComponent {}
