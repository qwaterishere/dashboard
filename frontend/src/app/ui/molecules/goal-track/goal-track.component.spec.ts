import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalTrackComponent } from './goal-track.component';

describe('GoalTrackComponent', () => {
  let fixture: ComponentFixture<GoalTrackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalTrackComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GoalTrackComponent);
    fixture.componentRef.setInput('headline', '22,1 млн · 103 %');
    fixture.componentRef.setInput('trackPct', 93.6);
    fixture.detectChanges();
  });

  it('renders forecast headline', () => {
    expect(fixture.nativeElement.textContent).toContain('22,1 млн · 103 %');
  });

  it('sets progress fill width from trackPct', () => {
    const fill = fixture.nativeElement.querySelector('app-progress-fill i') as HTMLElement;
    expect(fill.style.width).toBe('93.6%');
  });

  it('applies risk styling when risk is true', () => {
    fixture.componentRef.setInput('risk', true);
    fixture.detectChanges();
    const headline = fixture.nativeElement.querySelector('.g-row b') as HTMLElement;
    expect(headline.classList.contains('r')).toBe(true);
  });

  it('renders pace mark when planPct is between 0 and 100', () => {
    fixture.componentRef.setInput('planPct', 42);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-mark-line').length).toBe(1);
  });

  it('hides mark at period edge (planPct 0 or 100)', () => {
    fixture.componentRef.setInput('planPct', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-mark-line').length).toBe(0);

    fixture.componentRef.setInput('planPct', 100);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-mark-line').length).toBe(0);
  });
});
