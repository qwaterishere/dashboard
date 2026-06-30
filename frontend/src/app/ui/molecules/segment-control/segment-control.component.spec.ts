import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SegmentControlComponent } from './segment-control.component';

describe('SegmentControlComponent', () => {
  let fixture: ComponentFixture<SegmentControlComponent<string>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SegmentControlComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SegmentControlComponent<string>);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
    fixture.componentRef.setInput('value', 'a');
    fixture.detectChanges();
  });

  it('renders all options', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });
});
