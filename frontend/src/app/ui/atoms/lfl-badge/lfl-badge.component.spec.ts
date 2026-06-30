import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LflBadgeComponent } from './lfl-badge.component';

describe('LflBadgeComponent', () => {
  let fixture: ComponentFixture<LflBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LflBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LflBadgeComponent);
    fixture.componentRef.setInput('pct', 8.4);
    fixture.componentRef.setInput('direction', 'up');
    fixture.detectChanges();
  });

  it('renders LfL label', () => {
    expect(fixture.nativeElement.textContent).toContain('LfL');
    expect(fixture.nativeElement.textContent).toContain('+8,4 %');
  });
});
