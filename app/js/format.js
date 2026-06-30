// Форматирование чисел в ru-RU. Принцип: бэкенд присылает «сырые» числа,
// а человекочитаемый вид (разряды, ₽, %, запятая) собираем здесь.

/** Целое с разрядами: 8144000 → «8 144 000». */
export const fmt = (n) => Math.round(n).toLocaleString('ru-RU');

/** Деньги: 8144000 → «8 144 000 ₽». */
export const money = (n) => `${fmt(n)} ₽`;

/** Тысячи (для осей графиков): 800000 → «800к». */
export const k = (n) => `${Math.round(n / 1000).toLocaleString('ru-RU')}к`;

/** Миллионы: 22100000 → «22,1 млн». */
export const millions = (n) => `${(n / 1e6).toFixed(1).replace('.', ',')} млн`;

/** Процент с одним знаком: 31.2 → «31,2 %». */
export const pct = (n) => `${n.toFixed(1).replace('.', ',')} %`;

/** Процент без дробной части: 62.7 → «63 %». */
export const pctInt = (n) => `${Math.round(n)} %`;

/** Дробное в ru-RU: 2.3 → «2,3». */
export const decimal = (n) => n.toLocaleString('ru-RU');

/** Знаковый процент (минус — U+2212): 8.4 → «+8,4 %», -1.2 → «−1,2 %». */
export const signedPct = (n) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1).replace('.', ',')} %`;

/** Знаковые проценты-пункты: 1.2 → «+1,2 п.п.», -2.6 → «−2,6 п.п.». */
export const signedPP = (n) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1).replace('.', ',')} п.п.`;
