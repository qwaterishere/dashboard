import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileBlockComponent } from './profile-block.component';

describe('ProfileBlockComponent', () => {
  let fixture: ComponentFixture<ProfileBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileBlockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileBlockComponent);
    fixture.componentRef.setInput('initials', 'АК');
    fixture.componentRef.setInput('name', 'Алексей К.');
    fixture.componentRef.setInput('role', 'Управляющий');
    fixture.detectChanges();
  });

  it('hides unread dot by default', () => {
    expect(fixture.nativeElement.querySelector('.ndot')).toBeNull();
  });

  it('shows unread dot when hasUnread is true', () => {
    fixture.componentRef.setInput('hasUnread', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ndot')).not.toBeNull();
  });

  it('toggles empty notifications panel on bell click', () => {
    const bell = fixture.nativeElement.querySelector('.icon-btn') as HTMLButtonElement;
    bell.click();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.notif__panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent?.trim()).toBe('Нет уведомлений');

    bell.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notif__panel')).toBeNull();
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
