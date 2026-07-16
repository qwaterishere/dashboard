import { HttpErrorResponse } from '@angular/common/http';

/** Безопасные пользовательские сообщения для auth-форм (без утечки деталей API). */
export function resolveAuthError(err: HttpErrorResponse): string {
  if (err.status === 401) return 'Неверный email или пароль';
  if (err.status === 409) return 'Пользователь с таким email уже существует';
  if (err.status === 422) return 'Проверьте корректность заполнения полей';
  if (err.status === 429) return 'Слишком много попыток. Подождите минуту и повторите';
  if (err.status === 400) {
    const detail = typeof err.error?.detail === 'string' ? err.error.detail : '';
    if (detail === 'Invalid invite key') {
      return 'Неверный или уже использованный ключ доступа';
    }
    return 'Не удалось зарегистрироваться';
  }
  return 'Не удалось выполнить запрос. Попробуйте позже.';
}
