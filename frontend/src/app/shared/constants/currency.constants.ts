/** Валюты отображения сумм в UI (не конвертация). */

export type CurrencyCode =
  | 'RUB'
  | 'BYN'
  | 'KZT'
  | 'KGS'
  | 'AMD'
  | 'AZN'
  | 'MDL'
  | 'TJS'
  | 'TMT'
  | 'UZS'
  | 'USD'
  | 'EUR'
  | 'CNY';

export interface CurrencyOption {
  code: CurrencyCode;
  name: string;
  symbol: string;
}

/** СНГ + доллар, евро, юань. */
export const CURRENCIES: readonly CurrencyOption[] = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽' },
  { code: 'BYN', name: 'Белорусский рубль', symbol: 'Br' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
  { code: 'KGS', name: 'Киргизский сом', symbol: 'с' },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏' },
  { code: 'AZN', name: 'Азербайджанский манат', symbol: '₼' },
  { code: 'MDL', name: 'Молдавский лей', symbol: 'L' },
  { code: 'TJS', name: 'Таджикский сомони', symbol: 'SM' },
  { code: 'TMT', name: 'Туркменский манат', symbol: 'm' },
  { code: 'UZS', name: 'Узбекский сум', symbol: "so'm" },
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥' },
] as const;

export const DEFAULT_CURRENCY: CurrencyCode = 'RUB';

export const CURRENCY_BY_CODE: Record<CurrencyCode, CurrencyOption> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
) as Record<CurrencyCode, CurrencyOption>;

export function isCurrencyCode(value: string | null | undefined): value is CurrencyCode {
  return value != null && value in CURRENCY_BY_CODE;
}
