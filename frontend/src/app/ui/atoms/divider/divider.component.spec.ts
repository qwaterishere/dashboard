import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DividerComponent } from './divider.component';

describe('DividerComponent', () => {
  let fixture: ComponentFixture<DividerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DividerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DividerComponent);
    fixture.detectChanges();
  });

  it('renders semantic hr separator', () => {
    const hr = fixture.nativeElement.querySelector('hr.divider');
    expect(hr).toBeTruthy();
  });
});
