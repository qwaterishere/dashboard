import { HttpErrorResponse } from '@angular/common/http';

import { resolveSettingsError } from './settings-errors';

describe('resolveSettingsError', () => {
  it('maps invalid current password', () => {
    const err = new HttpErrorResponse({
      status: 401,
      error: { detail: 'Invalid current password' },
    });
    expect(resolveSettingsError(err)).toBe('Неверный текущий пароль');
  });

  it('maps same password validation', () => {
    const err = new HttpErrorResponse({
      status: 422,
      error: {
        detail: [
          {
            type: 'value_error',
            msg: 'Value error, New password must differ from the current password',
          },
        ],
      },
    });
    expect(resolveSettingsError(err)).toBe('Новый пароль должен отличаться от текущего');
  });

  it('maps rate limit', () => {
    const err = new HttpErrorResponse({ status: 429 });
    expect(resolveSettingsError(err)).toBe('Слишком много попыток. Подождите минуту и повторите');
  });

  it('falls back to generic message', () => {
    const err = new HttpErrorResponse({ status: 500 });
    expect(resolveSettingsError(err)).toBe('Не удалось сохранить изменения. Попробуйте позже.');
  });
});
