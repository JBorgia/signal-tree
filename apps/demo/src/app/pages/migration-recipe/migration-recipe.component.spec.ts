import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MigrationRecipeComponent } from './migration-recipe.component';

describe('MigrationRecipeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MigrationRecipeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders heading', () => {
    const fixture = TestBed.createComponent(MigrationRecipeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Move concepts, not syntax.'
    );
  });

  it('teaches owned state and version-specific migration', () => {
    const fixture = TestBed.createComponent(MigrationRecipeComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('@signal-tree/angular');
    expect(text).toContain('v16 evaluation prerelease');
    expect(text).toContain('not a stable v16 release');
    expect(text).toContain('npm install @signal-tree/angular@16.0.0-rc.1');
    expect(text).toContain('v15 to v16 checklist');
    expect(text).not.toContain('npm install @signal-tree/angular@16.0.0-dev');
    expect(text).toContain(
      'Construct state, capabilities, and derived values once'
    );
    expect(text).toContain('Move domain writes to explicit Ops services');
    expect(text).toContain(
      'Keep requests, cancellation, and persistence application-owned'
    );
    expect(text).toContain('Use EntityMap when keyed identity earns it');
    expect(text).toContain('No .with() or fluent .derived()');
  });
});
