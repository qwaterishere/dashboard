import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<BadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(BadgeComponent);
  });

  it('renders tag variant', () => {
    fixture.componentRef.setInput('label', 'Кухня');
    fixture.componentRef.setInput('variant', 'tag');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.badge--tag')?.textContent).toContain('Кухня');
  });

  it('maps abc variant to letter class', () => {
    fixture.componentRef.setInput('label', 'B');
    fixture.componentRef.setInput('variant', 'abc');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.badge--abc-b')).toBeTruthy();
  });
});
