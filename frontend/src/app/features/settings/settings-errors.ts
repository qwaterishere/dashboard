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
  if (err.status === 400 && err.error?.detail === 'Invalid iiko credentials') {
    return 'Не удалось авторизоваться в iiko — проверьте URL, логин и пароль';
  }
  if (err.status === 422) {
    const msg = detailMessage(err);
    if (msg?.includes('iiko_password is required')) {
      return 'Укажите пароль для первичного подключения';
    }
    if (msg?.includes('iiko URL must use https')) {
      return 'URL iiko должен начинаться с https://';
    }
    if (msg?.includes('iiko URL must not point to')) {
      return 'Укажите публичный URL сервера iiko, а не локальный или служебный адрес';
    }
    if (msg?.includes('Invalid iiko credentials')) {
      return 'Не удалось авторизоваться в iiko — проверьте URL, логин и пароль';
    }
    if (msg?.includes('differ from the current password')) {
      return 'Новый пароль должен отличаться от текущего';
    }
    if (msg?.includes('Password')) {
      return 'Пароль не соответствует политике безопасности';
    }
    return 'Проверьте корректность заполнения полей';
  }
  if (err.status === 429) return 'Слишком много попыток. Подождите минуту и повторите';
  if (err.status === 502) return 'Сервер iiko недоступен. Попробуйте позже';
  if (err.status === 409) return 'Загрузка уже выполняется';
  if (err.status === 400 && err.error?.detail === 'Configure iiko connection first') {
    return 'Сначала сохраните подключение iiko';
  }
  if (err.status === 403) {
    return 'Запрос отклонён. Обновите страницу и попробуйте снова';
  }
  if (err.status === 404) {
    return 'Сервис загрузки недоступен — перезапустите API-сервер';
  }
  if (err.status === 0) {
    return 'Нет связи с сервером. Проверьте, что API запущен';
  }
  return 'Не удалось сохранить изменения. Попробуйте позже.';
}

/** Сообщения для загрузки данных iiko (POST /me/iiko/sync и polling). */
export function resolveIikoSyncError(err: HttpErrorResponse): string {
  if (err.status === 404) {
    return 'Сервис загрузки недоступен — перезапустите API-сервер (uvicorn)';
  }
  const base = resolveSettingsError(err);
  if (base !== 'Не удалось сохранить изменения. Попробуйте позже.') {
    return base;
  }
  return 'Не удалось запустить загрузку данных из iiko. Попробуйте позже.';
}
