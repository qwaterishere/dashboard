import { WEEKDAYS_FULL } from '../constants/category.constants';
import type { DetailPopover } from '../models/common.model';
import type { PeriodV2 } from '../models/dashboard-v2.model';
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

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatSignedPct(value: number): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
}

function toIsoDate(period: PeriodV2, day: number): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Заголовок popover дня: «5 июня · пятница». */
export function formatDayPopoverTitle(day: RevenueDay, period: PeriodV2): string {
  const month = MONTHS_GENITIVE[period.month - 1] ?? '';
  return `${day.day} ${month} · ${WEEKDAYS_FULL[day.weekday]}`;
}

/** Контент popover при клике на столбик «Выручка по дням». */
export function buildDayDetailPopover(day: RevenueDay, period: PeriodV2): DetailPopover {
  const rows: DetailPopover['rows'] = [['Выручка', formatMoney(day.revenue)]];

  if (day.plan !== null && day.plan > 0) {
    const deltaPct = ((day.revenue - day.plan) / day.plan) * 100;
    rows.push([
      `К плану дня (${formatMoney(day.plan)})`,
      formatSignedPct(deltaPct),
      deltaPct >= 0 ? 'up' : 'dn',
    ]);
  } else {
    rows.push(['К плану дня', '—']);
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
