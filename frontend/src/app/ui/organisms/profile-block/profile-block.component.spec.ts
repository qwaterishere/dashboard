import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProfileBlockComponent } from './profile-block.component';

describe('ProfileBlockComponent', () => {
  let fixture: ComponentFixture<ProfileBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileBlockComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileBlockComponent);
    fixture.componentRef.setInput('initials', 'АК');
    fixture.componentRef.setInput('name', 'Алексей К.');
    fixture.componentRef.setInput('role', 'Управляющий');
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.querySelectorAll('.notif__panel').forEach((el) => el.remove());
    document.body.querySelectorAll('.confirm__panel').forEach((el) => el.remove());
  });

  it('hides unread dot by default', () => {
    expect(fixture.nativeElement.querySelector('.ndot')).toBeNull();
  });

  it('shows unread dot when hasUnread is true', () => {
    fixture.componentRef.setInput('hasUnread', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ndot')).not.toBeNull();
  });

  it('toggles empty notifications panel on bell click', async () => {
    const bell = fixture.nativeElement.querySelector('.notif-btn') as HTMLButtonElement;
    bell.click();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const panel = document.body.querySelector('.notif__panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent?.trim()).toBe('Нет уведомлений');

    bell.click();
    fixture.detectChanges();
    expect(document.body.querySelector('.notif__panel')).toBeNull();
  });

  it('lists notification items in the panel', async () => {
    fixture.componentRef.setInput('notifications', [
      {
        id: 'n1',
        message: 'Тестовое уведомление',
        link: '/settings',
        fragment: 'iiko-sync',
      },
    ]);
    fixture.componentRef.setInput('hasUnread', true);
    fixture.detectChanges();

    const bell = fixture.nativeElement.querySelector('.notif-btn') as HTMLButtonElement;
    bell.click();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    const panel = document.body.querySelector('.notif__panel') as HTMLElement;
    expect(panel.textContent).toContain('Тестовое уведомление');
  });

  it('emits themeToggled from ThemeToggle icon', () => {
    const toggles: void[] = [];
    fixture.componentInstance.themeToggled.subscribe(() => toggles.push(undefined));
    const themeBtn = fixture.nativeElement.querySelector(
      'app-theme-toggle button',
    ) as HTMLButtonElement;
    themeBtn.click();
    expect(toggles).toHaveLength(1);
  });

  it('opens confirm dialog on logout and emits only after confirm', async () => {
    const logouts: void[] = [];
    fixture.componentInstance.logout.subscribe(() => logouts.push(undefined));

    const logoutBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === 'Выйти');
    logoutBtn?.click();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(document.body.querySelector('.confirm__panel')).not.toBeNull();
    expect(logouts).toHaveLength(0);

    const confirmBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Выйти' && b.closest('.confirm__panel'),
    ) as HTMLButtonElement | undefined;
    confirmBtn?.click();
    fixture.detectChanges();

    expect(logouts).toHaveLength(1);
    expect(document.body.querySelector('.confirm__panel')).toBeNull();
  });
});
