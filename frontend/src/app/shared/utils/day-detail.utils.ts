import { WEEKDAYS_FULL } from '../constants/category.constants';
import type { DetailPopover } from '../models/common.model';
import type { ApiPeriod } from '../models/dashboard-api.model';
import type { RevenueDay } from '../models/dashboard.model';

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatSignedPct(value: number): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
}

function toIsoDate(period: ApiPeriod, day: number): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Заголовок popover дня: «5 июня · пятница». */
export function formatDayPopoverTitle(day: RevenueDay, period: ApiPeriod): string {
  const month = MONTHS_GENITIVE[period.month - 1] ?? '';
  return `${day.day} ${month} · ${WEEKDAYS_FULL[day.weekday]}`;
}

/** Контент popover при клике на столбик «Выручка по дням». */
export function buildDayDetailPopover(day: RevenueDay, period: ApiPeriod): DetailPopover {
  const rows: DetailPopover['rows'] = [['Выручка', formatMoney(day.revenue)]];

  if (day.forecast !== null && day.forecast > 0) {
    const deltaPct = ((day.revenue - day.forecast) / day.forecast) * 100;
    rows.push([
      `К прогнозу дня (${formatMoney(day.forecast)})`,
      formatSignedPct(deltaPct),
      deltaPct >= 0 ? 'up' : 'dn',
    ]);
  } else if (day.plan !== null && day.plan > 0) {
    const deltaPct = ((day.revenue - day.plan) / day.plan) * 100;
    rows.push([
      `К плану дня (${formatMoney(day.plan)})`,
      formatSignedPct(deltaPct),
      deltaPct >= 0 ? 'up' : 'dn',
    ]);
  } else {
    rows.push(['К прогнозу дня', '—']);
  }

  rows.push(
    [
      'Чеки · средний чек',
      `${day.checks.toLocaleString('ru-RU')} · ${formatMoney(day.avg)}`,
    ],
    ['Гости', day.guests.toLocaleString('ru-RU')],
  );

  const iso = toIsoDate(period, day.day);

  return {
    title: formatDayPopoverTitle(day, period),
    rows,
    footnote: 'Подробнее о дне →',
    footnoteLink: '/sales',
    footnoteQueryParams: { date_from: iso, date_to: iso },
  };
}

function monthIsoRange(year: number, month: number): { date_from: string; date_to: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return {
    date_from: `${year}-${mm}-01`,
    date_to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Контент popover для агрегированных столбцов (неделя, квартал). */
export function buildAggregatedBarDetailPopover(
  day: RevenueDay,
  label: string,
  year: number,
): DetailPopover {
  const rows: DetailPopover['rows'] = [
    ['Выручка', formatMoney(day.revenue)],
    [
      'Чеки · средний чек',
      `${day.checks.toLocaleString('ru-RU')} · ${formatMoney(day.avg)}`,
    ],
    ['Гости', day.guests.toLocaleString('ru-RU')],
  ];

  return {
    title: `${label} ${year}`,
    rows,
    footnote: 'Подробнее →',
    footnoteLink: '/sales',
  };
}

/** Контент popover при клике на столбик «Выручка по месяцам». */
export function buildMonthDetailPopover(day: RevenueDay, year: number): DetailPopover {
  const month = day.day;
  const rows: DetailPopover['rows'] = [
    ['Выручка', formatMoney(day.revenue)],
  ];

  if (day.forecast !== null && day.forecast > 0) {
    const deltaPct = ((day.revenue - day.forecast) / day.forecast) * 100;
    rows.push([
      `К прогнозу месяца (${formatMoney(day.forecast)})`,
      formatSignedPct(deltaPct),
      deltaPct >= 0 ? 'up' : 'dn',
    ]);
  } else if (day.plan !== null && day.plan > 0) {
    rows.push(['К плану месяца', formatMoney(day.plan)]);
  } else {
    rows.push(['К прогнозу месяца', '—']);
  }

  rows.push(
    [
      'Чеки · средний чек',
      `${day.checks.toLocaleString('ru-RU')} · ${formatMoney(day.avg)}`,
    ],
    ['Гости', day.guests.toLocaleString('ru-RU')],
  );
  const range = monthIsoRange(year, month);

  return {
    title: `${MONTHS_NOMINATIVE[month - 1] ?? month} ${year}`,
    rows,
    footnote: 'Подробнее о месяце →',
    footnoteLink: '/sales',
    footnoteQueryParams: range,
  };
}
