import { environment } from '../../../environments/environment';

/** Синхронизировано с backend `password_policy.password_min_length`. */
export const PASSWORD_MIN_LENGTH = environment.production ? 12 : 8;

export const PASSWORD_REQUIRES_COMPLEXITY = environment.production;

export const PASSWORD_HINT = PASSWORD_REQUIRES_COMPLEXITY
  ? 'Минимум 12 символов, заглавная и строчная буква, цифра и спецсимвол'
  : 'Минимум 8 символов';
