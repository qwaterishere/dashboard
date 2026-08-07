import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AttentionItemComponent } from './attention-item.component';

describe('AttentionItemComponent', () => {
  let fixture: ComponentFixture<AttentionItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttentionItemComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AttentionItemComponent);
  });

  it('passes queryParams to routerLink', () => {
    fixture.componentRef.setInput('severity', 'critical');
    fixture.componentRef.setInput('title', 'Минусовые остатки');
    fixture.componentRef.setInput('detail', '3 поз. · дыра 12 400 ₽');
    fixture.componentRef.setInput('actionLabel', 'К складу');
    fixture.componentRef.setInput('actionKind', 'link');
    fixture.componentRef.setInput('link', '/warehouse');
    fixture.componentRef.setInput('queryParams', { focus: 'negative' });
    fixture.detectChanges();

    const linkDe = fixture.debugElement.query(By.directive(RouterLink));
    expect(linkDe).toBeTruthy();
    const href = (linkDe.nativeElement as HTMLAnchorElement).getAttribute('href');
    expect(href).toContain('/warehouse');
    expect(href).toContain('focus=negative');
    expect(fixture.nativeElement.textContent).toContain('Минусовые остатки');
    expect(fixture.nativeElement.textContent).toContain('3 поз');
  });
});
