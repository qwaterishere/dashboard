import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  async function flushPortal(): Promise<void> {
    await Promise.resolve();
    fixture.detectChanges();
  }

  function panel(): HTMLElement | null {
    return document.body.querySelector('.confirm__panel');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('title', 'Выйти?');
    fixture.componentRef.setInput('message', 'Сессия будет завершена.');
    fixture.componentRef.setInput('confirmLabel', 'Выйти');
    fixture.detectChanges();
    await flushPortal();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.querySelectorAll('.confirm').forEach((el) => el.remove());
  });

  it('renders title and message', () => {
    const text = panel()?.textContent ?? '';
    expect(text).toContain('Выйти?');
    expect(text).toContain('Сессия будет завершена.');
  });

  it('emits confirmed from confirm button', () => {
    const confirmed: void[] = [];
    fixture.componentInstance.confirmed.subscribe(() => confirmed.push(undefined));

    const confirmBtn = Array.from(panel()?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Выйти',
    );
    confirmBtn?.click();

    expect(confirmed).toHaveLength(1);
  });

  it('emits cancelled from cancel button', () => {
    const cancelled: void[] = [];
    fixture.componentInstance.cancelled.subscribe(() => cancelled.push(undefined));

    const cancelBtn = Array.from(panel()?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Отмена',
    );
    cancelBtn?.click();

    expect(cancelled).toHaveLength(1);
  });
});
