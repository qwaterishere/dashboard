import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { WarehousePosition } from '../../../../shared/models';
import { NegativeStockBannerOrganismComponent } from './negative-stock-banner-organism.component';

const POSITIONS: WarehousePosition[] = [
  {
    productId: '1',
    name: 'Мука',
    category: 'Бакалея',
    store: 'k',
    qty: -2,
    unit: 'кг',
    value: -400,
  },
  {
    productId: '2',
    name: 'Вино',
    category: 'Вино',
    store: 'w',
    qty: -1,
    unit: 'бут',
    value: -1200,
  },
  {
    productId: '3',
    name: 'Сахар',
    category: 'Бакалея',
    store: 'k',
    qty: 5,
    unit: 'кг',
    value: 250,
  },
];

describe('NegativeStockBannerOrganismComponent', () => {
  let fixture: ComponentFixture<NegativeStockBannerOrganismComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NegativeStockBannerOrganismComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NegativeStockBannerOrganismComponent);
    fixture.componentRef.setInput('summary', { count: 2, valueAbs: 1600 });
    fixture.componentRef.setInput('positions', POSITIONS);
    fixture.detectChanges();
  });

  it('toggles negative positions panel on banner click', () => {
    const banner = fixture.nativeElement.querySelector('.neg__banner') as HTMLButtonElement;
    expect(fixture.nativeElement.querySelector('.neg__panel')).toBeNull();

    banner.click();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.neg__panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('Мука');
    expect(panel.textContent).toContain('Вино');
    expect(panel.textContent).not.toContain('Сахар');

    banner.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.neg__panel')).toBeNull();
  });

  it('opens detail when initiallyOpen is true', () => {
    fixture.componentRef.setInput('initiallyOpen', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.neg__panel')).not.toBeNull();
  });
});
