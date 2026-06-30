import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PeriodBarComponent } from './period-bar.component';

describe('PeriodBarComponent', () => {
  let fixture: ComponentFixture<PeriodBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeriodBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PeriodBarComponent);
    fixture.componentRef.setInput('period', {
      label: 'Июнь 2026',
      note: '1–11 · закрытые дни',
      compareWith: 'июнем 2025',
    });
    fixture.detectChanges();
  });

  it('renders period label and LfL compare', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Июнь 2026');
    expect(el.textContent).toContain('LfL');
    expect(el.textContent).toContain('июнем 2025');
  });

  it('renders granularity segments', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Неделя');
    expect(el.textContent).toContain('Месяц');
    expect(el.textContent).toContain('Год');
  });
});
