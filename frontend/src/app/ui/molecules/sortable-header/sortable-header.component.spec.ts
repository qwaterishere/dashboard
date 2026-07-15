import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SortableHeaderComponent } from './sortable-header.component';

describe('SortableHeaderComponent', () => {
  let fixture: ComponentFixture<SortableHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortableHeaderComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SortableHeaderComponent);
    fixture.componentRef.setInput('label', 'Выручка');
    fixture.detectChanges();
  });

  it('emits activated on click', () => {
    const activations: boolean[] = [];
    fixture.componentInstance.activated.subscribe(() => activations.push(true));
    fixture.nativeElement.querySelector('button').click();
    expect(activations).toEqual([true]);
  });

  it('shows sort icon only when active', () => {
    fixture.componentRef.setInput('active', true);
    fixture.componentRef.setInput('direction', 'desc');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sortable-header__icon').textContent.trim()).toBe('▾');
  });

  it('sets aria-label for inactive state', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Сортировать по «Выручка»');
  });
});
