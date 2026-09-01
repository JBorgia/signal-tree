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

  it('teaches the v15 target architecture', () => {
    const fixture = TestBed.createComponent(MigrationRecipeComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('@signal-tree/angular');
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
