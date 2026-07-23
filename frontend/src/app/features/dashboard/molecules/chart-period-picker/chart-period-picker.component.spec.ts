import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartPeriodPickerComponent } from './chart-period-picker.component';

describe('ChartPeriodPickerComponent', () => {
  let fixture: ComponentFixture<ChartPeriodPickerComponent>;

  const activePeriod = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
  const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };

  function bindPanelOpen(): void {
    let open = false;
    fixture.componentRef.setInput('panelOpen', open);
    fixture.componentInstance.panelOpenChange.subscribe((value) => {
      open = value;
      fixture.componentRef.setInput('panelOpen', value);
      fixture.detectChanges();
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartPeriodPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartPeriodPickerComponent);
    fixture.componentRef.setInput('label', 'Июнь 2026');
    fixture.componentRef.setInput('note', '1–11 · закрытые дни');
    fixture.componentRef.setInput('granularity', 'month');
    fixture.componentRef.setInput('bounds', bounds);
    fixture.componentRef.setInput('activePeriod', activePeriod);
    fixture.componentRef.setInput('selection', null);
    fixture.componentRef.setInput('showReset', false);
    bindPanelOpen();
    fixture.detectChanges();
  });

  it('renders interactive date pill trigger', () => {
    const trigger = fixture.nativeElement.querySelector('.date-pill--interactive');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Июнь 2026');
  });

  it('opens picker panel on trigger click', () => {
    fixture.nativeElement.querySelector('.date-pill--interactive').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.picker__panel')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Выбор месяца');
  });

  it('emits applied selection for month granularity', () => {
    const applied: unknown[] = [];
    fixture.componentInstance.applied.subscribe((value) => applied.push(value));

    fixture.nativeElement.querySelector('.date-pill--interactive').click();
    fixture.detectChanges();

    const mayHost = [...fixture.nativeElement.querySelectorAll('.picker__month')].find(
      (host: Element) => host.textContent?.includes('май'),
    ) as HTMLElement;
    (mayHost.querySelector('button') ?? mayHost).click();
    fixture.detectChanges();

    const applyHost = fixture.nativeElement.querySelector('.picker__apply') as HTMLElement;
    (applyHost.querySelector('button') ?? applyHost).click();
    fixture.detectChanges();

    expect(applied).toEqual([{ year: 2026, month: 5 }]);
    expect(fixture.nativeElement.querySelector('.picker__panel')).toBeFalsy();
  });

  it('shows reset button only when showReset is true', () => {
    fixture.nativeElement.querySelector('.date-pill--interactive').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Сбросить');

    fixture.componentRef.setInput('showReset', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Сбросить');
  });

  it('emits resetSelection when reset is clicked', () => {
    const resets: unknown[] = [];
    fixture.componentRef.setInput('showReset', true);
    fixture.componentInstance.resetSelection.subscribe(() => resets.push(true));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.date-pill--interactive').click();
    fixture.detectChanges();

    const resetHost = [...fixture.nativeElement.querySelectorAll('app-button')].find(
      (host: Element) => host.textContent?.trim() === 'Сбросить',
    ) as HTMLElement;
    (resetHost.querySelector('button') ?? resetHost).click();
    fixture.detectChanges();

    expect(resets).toEqual([true]);
    expect(fixture.nativeElement.querySelector('.picker__panel')).toBeFalsy();
  });

  it('emits panelOpenChange(false) on Escape', () => {
    const changes: boolean[] = [];
    fixture.componentInstance.panelOpenChange.subscribe((value) => changes.push(value));

    fixture.componentRef.setInput('panelOpen', true);
    fixture.detectChanges();

    fixture.componentInstance.onEscape();
    expect(changes).toContain(false);
  });

  it('marks and blocks dataframe month in compare picker', () => {
    fixture.componentRef.setInput('triggerKind', 'compare');
    fixture.componentRef.setInput('compareWith', 'маем 2026');
    fixture.componentRef.setInput('dataframePeriod', {
      year: 2026,
      month: 6,
      dayFrom: 1,
      dayTo: 11,
    });
    fixture.componentRef.setInput('dataframePeriodLabel', '1–11 июня 2026');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.cmp-pill--interactive').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Текущий период датафрейма');
    expect(fixture.nativeElement.textContent).toContain('1–11 июня 2026');

    const juneHost = [...fixture.nativeElement.querySelectorAll('.picker__month')].find(
      (host: Element) => host.textContent?.includes('июн'),
    ) as HTMLElement;
    expect(juneHost.classList.contains('picker__month--dataframe')).toBe(true);
    expect(juneHost.textContent).not.toContain('датафрейм');
    expect((juneHost.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps dataframe month selectable in week compare so other weeks remain available', () => {
    fixture.componentRef.setInput('granularity', 'week');
    fixture.componentRef.setInput('triggerKind', 'compare');
    fixture.componentRef.setInput('compareWith', '1–7 июня');
    fixture.componentRef.setInput('activePeriod', {
      year: 2026,
      month: 6,
      dayFrom: 1,
      dayTo: 7,
    });
    fixture.componentRef.setInput('dataframePeriod', {
      year: 2026,
      month: 6,
      dayFrom: 8,
      dayTo: 14,
    });
    fixture.componentRef.setInput('dataframeWeekRange', {
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });
    fixture.componentRef.setInput('dataframePeriodLabel', '8–14 июня 2026');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.cmp-pill--interactive').click();
    fixture.detectChanges();

    const juneHost = [...fixture.nativeElement.querySelectorAll('.picker__month')].find(
      (host: Element) => host.textContent?.includes('июн'),
    ) as HTMLElement;
    expect(juneHost.classList.contains('picker__month--dataframe')).toBe(true);
    expect((juneHost.querySelector('button') as HTMLButtonElement).disabled).toBe(false);

    const mayHost = [...fixture.nativeElement.querySelectorAll('.picker__month')].find(
      (host: Element) => host.textContent?.includes('май'),
    ) as HTMLElement;
    (mayHost.querySelector('button') ?? mayHost).click();
    fixture.detectChanges();

    (juneHost.querySelector('button') ?? juneHost).click();
    fixture.detectChanges();

    expect(fixture.componentInstance['draftMonth']()).toBe(6);

    const dataframeWeek = [...fixture.nativeElement.querySelectorAll('.picker__week')].find(
      (host: Element) => host.classList.contains('picker__week--dataframe'),
    ) as HTMLElement;
    expect(dataframeWeek).toBeTruthy();
    expect((dataframeWeek.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
