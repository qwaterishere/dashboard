import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CAT_COLOR } from '../../../shared/constants/category.constants';
import { DotComponent } from './dot.component';

/** Браузер в jsdom отдаёт rgb(), не hex. */
function hexToRgb(hex: string): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe('DotComponent', () => {
  let fixture: ComponentFixture<DotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DotComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DotComponent);
  });

  function dotBg(): string {
    fixture.detectChanges();
    return (fixture.nativeElement.querySelector('.dot') as HTMLElement).style.background;
  }

  it('uses kitchen color for default variant', () => {
    expect(dotBg()).toBe(hexToRgb(CAT_COLOR.k));
  });

  it('uses bar color for variant b', () => {
    fixture.componentRef.setInput('variant', 'b');
    expect(dotBg()).toBe(hexToRgb(CAT_COLOR.b));
  });

  it('color input overrides variant', () => {
    fixture.componentRef.setInput('variant', 'b');
    fixture.componentRef.setInput('color', '#ff0000');
    expect(dotBg()).toBe('rgb(255, 0, 0)');
  });
});
