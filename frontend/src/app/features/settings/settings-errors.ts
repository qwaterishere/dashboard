import { HttpErrorResponse } from '@angular/common/http';

function detailMessage(err: HttpErrorResponse): string | undefined {
  const detail = err.error?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first?.msg === 'string') return first.msg;
    if (typeof first?.type === 'string') return first.type;
  }
  return undefined;
}

/** Безопасные сообщения для страницы настроек. */
export function resolveSettingsError(err: HttpErrorResponse): string {
  if (err.status === 401) {
    const detail = err.error?.detail;
    if (detail === 'Invalid current password') return 'Неверный текущий пароль';
    return 'Сессия истекла. Войдите снова';
  }
  if (err.status === 422) {
    const msg = detailMessage(err);
    if (msg?.includes('differ from the current password')) {
      return 'Новый пароль должен отличаться от текущего';
    }
    if (msg?.includes('Password')) {
      return 'Пароль не соответствует политике безопасности';
    }
    return 'Проверьте корректность заполнения полей';
  }
  if (err.status === 429) return 'Слишком много попыток. Подождите минуту и повторите';
  return 'Не удалось сохранить изменения. Попробуйте позже.';
}
