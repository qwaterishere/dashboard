import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbcAnalysisOrganismComponent } from './abc-analysis-organism.component';
import type { SalesPositionComputed } from '../../data/sales-aggregation.utils';

function pos(
  partial: Partial<SalesPositionComputed> & Pick<SalesPositionComputed, 'name' | 'rev' | 'gp'>,
): SalesPositionComputed {
  return {
    sub: 'sub',
    cat: 'k',
    qty: 10,
    cost: 1,
    fc: 10,
    ...partial,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AbcAnalysisOrganismComponent', () => {
  let fixture: ComponentFixture<AbcAnalysisOrganismComponent>;
  let component: AbcAnalysisOrganismComponent;

  const positions: SalesPositionComputed[] = [
    pos({ name: 'Стейк', rev: 500, gp: 400, cat: 'k' }),
    pos({ name: 'Паста', rev: 300, gp: 200, cat: 'k' }),
    pos({ name: 'Вино', rev: 150, gp: 80, cat: 'w' }),
    pos({ name: 'Чай', rev: 50, gp: 40, cat: 'b' }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbcAnalysisOrganismComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AbcAnalysisOrganismComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('positions', positions);
    fixture.detectChanges();
  });

  const visibleNames = (): string[] => {
    const host = component as unknown as {
      visibleRows: () => { name: string }[];
    };
    return host.visibleRows().map((row) => row.name);
  };

  it('defaults to A+B+C filter with concentration viz', () => {
    expect(component.filter()).toEqual({ A: true, B: true, C: true });
    expect(fixture.nativeElement.querySelector('.abc-c-collapse')).toBeNull();
    expect(fixture.nativeElement.querySelector('.abc-viz')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.abc-pareto__svg')).toBeTruthy();
    expect(visibleNames()).toEqual(['Стейк', 'Паста', 'Вино', 'Чай']);
  });

  it('hides C and shows collapse banner when C is toggled off', () => {
    component.toggleFilter('C');
    fixture.detectChanges();
    expect(component.filter().C).toBe(false);
    expect(fixture.nativeElement.querySelector('.abc-c-collapse')).toBeTruthy();
    expect(visibleNames()).not.toContain('Чай');
  });

  it('showClassC expands C into the table and hides collapse banner', () => {
    component.toggleFilter('C');
    fixture.detectChanges();
    component.showClassC();
    fixture.detectChanges();
    expect(component.filter().C).toBe(true);
    expect(fixture.nativeElement.querySelector('.abc-c-collapse')).toBeNull();
    expect(visibleNames()).toContain('Чай');
  });

  it('search filters by name with debounce', async () => {
    const input = fixture.nativeElement.querySelector('.abc-search input') as HTMLInputElement;
    input.value = 'вино';
    input.dispatchEvent(new Event('input'));
    await delay(250);
    fixture.detectChanges();

    expect(visibleNames()).toEqual(['Вино']);
  });

  it('category filter limits visible rows', () => {
    component.category.set('w');
    fixture.detectChanges();

    expect(visibleNames()).toEqual(['Вино']);
  });

  it('renders concentration insight for class A', () => {
    const headline = fixture.nativeElement.querySelector('.abc-viz__headline')?.textContent ?? '';
    expect(headline).toContain('A');
    expect(headline).toMatch(/%/);
  });
});
