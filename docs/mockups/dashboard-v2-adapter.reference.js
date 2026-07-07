/* ================================================================
   РЕФЕРЕНС для миграции фронта на контракт v2 (/api/dashboard).
   Это НЕ production-код: рабочий адаптер v2 -> v1-рендер, которым
   бэкенд проверял контракт сквозным тестом 07.07.2026 (страница
   отрисовалась на реальных данных без ошибок консоли).
   Берите формулы производных; отображение — на ваше усмотрение.
   Зависимости из старого фронта: fmt() (format.js), r1().
   ================================================================ */
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_INS = ['январем','февралем','мартом','апрелем','маем','июнем','июлем','августом','сентябрем','октябрем','ноябрем','декабрем'];

function lflOf(value, prevValue) {
  if (!prevValue) return { pct: 0, dir: 'up' };   // prevValue null -> сравнивать не с чем
  return { pct: r1((value - prevValue) / prevValue * 100), dir: value >= prevValue ? 'up' : 'dn' };
}
function fcOf(forecast) {
  // forecast null -> «прогноз не готов» (< 7 закрытых дней)
  return { value: forecast ?? 0, planPct: 0, trackPct: 0, risk: false };
}
function lflDetail(title, cmp, per, prevValue, cur, unit) {
  if (prevValue == null) return { title, rows: [['Сравнить не с чем', '—']], footnote: 'нет данных прошлого года' };
  const d = cur - prevValue;
  return { title, rows: [
    [`${MONTHS[per.month - 1]} ${cmp.year}`, `${fmt(Math.round(prevValue))} ${unit}`],
    [`${MONTHS[per.month - 1]} ${per.year}`, `${fmt(Math.round(cur))} ${unit}`],
    ['Разница', `${d >= 0 ? '+' : '−'}${fmt(Math.round(Math.abs(d)))} ${unit}`, d >= 0 ? 'up' : 'dn'],
  ], footnote: 'Календарное сравнение по закрытым дням (адаптер v2).' };
}

function adaptV2(v) {
  const k = v.kpis;
  const unitNames = { k: 'Кухня', b: 'Бар', w: 'Вино' };
  const kbw = v.units.filter((u) => u.key !== 'o');   // 'o' не входит в донат юнитов
  const unitsSum = kbw.reduce((s, u) => s + u.revenue, 0);
  const avgOf = (r) => (r.checks ? Math.round(r.revenue / r.checks) : 0);
  return {
    greeting: 'Сезоны',
    period: {
      label: `${MONTHS[v.period.month - 1]} ${v.period.year}`,
      note: `${v.period.dayFrom}–${v.period.dayTo} · закрытые дни`,
      compareWith: `${MONTHS_INS[v.compare.month - 1]} ${v.compare.year}`,
    },
    kpis: {
      revenue: { value: k.revenue.value, lfl: lflOf(k.revenue.value, k.revenue.prevValue),
                 checks: k.checks.value, guests: k.guests.value, forecast: fcOf(k.revenue.forecast) },
      avgCheck: { value: k.avgCheck.value, lfl: lflOf(k.avgCheck.value, k.avgCheck.prevValue),
                  perGuest: k.guests.value ? Math.round(k.revenue.value / k.guests.value) : 0,
                  qualityFlag: false, forecast: fcOf(k.avgCheck.forecast) },
      guests: { value: k.guests.value, lfl: lflOf(k.guests.value, k.guests.prevValue),
                perCheck: k.checks.value ? r1(k.guests.value / k.checks.value) : 0,
                checks: k.checks.value, forecast: fcOf(k.guests.forecast) },
    },
    revenueByDay: v.revenueByDay.map((d) => ({ ...d, plan: d.plan ?? 0, avg: avgOf(d) })),
    revenueByDayMax: Math.max(...v.revenueByDay.map((d) => d.revenue), 1),
    reviews: { score: 0, count: 0, split: { good: 0, mid: 0, bad: 0, goodPct: 0, midPct: 0, badPct: 0 }, sources: [] },
    foodcostMini: {
      caption: 'Средняя себестоимость продаж за период',
      items: kbw.map((u) => {
        const p = u.revenue ? r1(u.cost / u.revenue * 100) : 0;
        const pp = u.prevRevenue ? r1(u.prevCost / u.prevRevenue * 100) : 0;
        const d = pp ? r1(p - pp) : 0;
        return { key: u.key, name: unitNames[u.key], pct: p, goal: 0, deltaPP: d, dir: d > 0 ? 'dn' : 'up' };
      }),
    },
    categories: kbw.map((u) => ({ key: u.key, name: unitNames[u.key],
                                  pct: unitsSum ? r1(u.revenue / unitsSum * 100) : 0 })),
    stock: { total: 0, items: [] },
    details: {
      'rev-lfl': lflDetail('LfL — выручка', v.compare, v.period, k.revenue.prevValue, k.revenue.value, 'с'),
      'check-lfl': lflDetail('LfL — средний чек', v.compare, v.period, k.avgCheck.prevValue, k.avgCheck.value, 'с'),
      'guests-lfl': lflDetail('LfL — гости', v.compare, v.period, k.guests.prevValue, k.guests.value, ''),
    },
  };
}
