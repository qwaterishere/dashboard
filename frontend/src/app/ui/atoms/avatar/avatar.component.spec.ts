import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let fixture: ComponentFixture<AvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AvatarComponent);
  });

  it('renders initials', () => {
    fixture.componentRef.setInput('initials', 'АК');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent?.trim()).toBe('АК');
  });
});
