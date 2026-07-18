import {
  CURRENCY_BY_CODE,
  DEFAULT_CURRENCY,
  type CurrencyCode,
} from '../constants/currency.constants';

/** Активный код для чистых formatMoney-хелперов вне DI (мапперы). */
let activeCurrencyCode: CurrencyCode = DEFAULT_CURRENCY;

export function setActiveCurrencyCode(code: CurrencyCode): void {
  activeCurrencyCode = code;
}

export function getActiveCurrencyCode(): CurrencyCode {
  return activeCurrencyCode;
}

export function getActiveCurrencySymbol(): string {
  return CURRENCY_BY_CODE[activeCurrencyCode].symbol;
}

/** Сырое число → строка с символом активной валюты (ru-RU группировка). */
export function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ${getActiveCurrencySymbol()}`;
}
