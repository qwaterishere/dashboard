import { fmt, money, millions, pct, decimal, signedPct, signedPP } from '../format.js';
import { CAT_FILL_CLASS, WEEKDAYS_SHORT, WEEKDAYS_FULL } from '../palette.js';
import { loadPage } from '../api.js';

const $ = (sel) => document.querySelector(sel);
/** Округлить до 1 знака и вернуть числом (убирает «78.00000001» в ширинах). */
const r1 = (n) => Math.round(n * 10) / 10;

const QUALITY_ICON =
  '<span class="dq-icon" data-pop="check-quality" role="img" aria-label="признак занижения гостей">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M10.3 4.2L2.6 17.6a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z"/>' +
  '<path d="M12 9.5v4"/><path d="M12 17.2v.01"/></svg></span>';

const fillClass = (key) => {
  const c = CAT_FILL_CLASS[key];
  return c ? ` class="${c}"` : '';
};

/* ---------- шапка ---------- */
function renderHeader(d) {
  $('#greeting').innerHTML = `Добрый вечер, ${d.greeting}<em>!</em>`;
  $('#periodLabel').textContent = d.period.label;
  $('#periodNote').textContent = d.period.note;
  $('#compareWith').textContent = d.period.compareWith;
}

/* ---------- KPI ---------- */
function lflBadge(popKey, lfl) {
  return `<span class="lfl ${lfl.dir}" data-pop="${popKey}">LfL ${signedPct(lfl.pct)}</span>`;
}
function goalBlock(popKey, headline, trackPct, risk) {
  const b = risk ? '<b class="r">' : '<b>';
  const i = risk ? `<i class="r" style="width:${trackPct}%"></i>` : `<i style="width:${trackPct}%"></i>`;
  return `<div class="k-goal" data-pop="${popKey}">
      <div class="g-row"><span>Прогноз на конец месяца</span>${b}${headline}</b></div>
      <div class="g-track">${i}<span class="g-mark"></span></div>
    </div>`;
}
function renderKpis(k) {
  const { revenue: rev, avgCheck: chk, guests: g } = k;
  $('#kpis').innerHTML = `
    <div class="kpi m-rev">
      <div class="k-top"><span class="ttl">Выручка</span></div>
      <div class="k-val"><span class="big">${money(rev.value)}</span>${lflBadge('rev-lfl', rev.lfl)}</div>
      <div class="k-sub">${fmt(rev.checks)} чеков · ${fmt(rev.guests)} гостя</div>
      ${goalBlock('rev-goal', `${millions(rev.forecast.value)} · ${rev.forecast.planPct} %`, rev.forecast.trackPct, rev.forecast.risk)}
    </div>
    <div class="kpi m-check">
      <div class="k-top"><span class="ttl">Средний чек</span></div>
      <div class="k-val"><span class="big">${money(chk.value)}</span>${lflBadge('check-lfl', chk.lfl)}</div>
      <div class="k-sub">на гостя: <b>${money(chk.perGuest)}</b> ${chk.qualityFlag ? QUALITY_ICON : ''}</div>
      ${goalBlock('check-goal', `${money(chk.forecast.value)} · ${chk.forecast.planPct} %`, chk.forecast.trackPct, chk.forecast.risk)}
    </div>
    <div class="kpi m-guests">
      <div class="k-top"><span class="ttl">Гости</span></div>
      <div class="k-val"><span class="big">${fmt(g.value)}</span>${lflBadge('guests-lfl', g.lfl)}</div>
      <div class="k-sub">${decimal(g.perCheck)} гостя на чек · <b>${fmt(g.checks)}</b> чеков</div>
      ${goalBlock('guests-goal', `${fmt(g.forecast.value)} · ${g.forecast.planPct} %`, g.forecast.trackPct, g.forecast.risk)}
    </div>`;
}

/* ---------- правая колонка и нижние панели ---------- */
function renderReviews(r) {
  $('#reviews').innerHTML = `
    <div class="rev-top">
      <div class="rev-score">
        <div class="rs-num">${decimal(r.score)}<span>★</span></div>
        <div class="rs-cap">средний балл · ${r.count} отзывов</div>
      </div>
      <div class="rev-split">
        <div class="rev-bar">
          <i class="good" style="width:${r.split.goodPct}%"></i><i class="mid" style="width:${r.split.midPct}%"></i><i class="bad" style="width:${r.split.badPct}%"></i>
        </div>
        <div class="rev-legend">
          <span><b class="good-t">${r.split.good}</b> хорошие <span class="rl-cap">4–5★</span></span>
          <span><b class="mid-t">${r.split.mid}</b> средние <span class="rl-cap">3★</span></span>
          <span><b class="bad-t">${r.split.bad}</b> плохие <span class="rl-cap">1–2★</span></span>
        </div>
      </div>
    </div>
    <div class="rev-src">
      ${r.sources.map((s) => `<div class="src-row"><span class="src-name">${s.name}</span><span class="src-val">${decimal(s.score)} <span class="src-n">· ${s.count}</span></span></div>`).join('')}
    </div>`;
}

function renderFoodcostMini(fc) {
  $('#fcMiniCap').textContent = fc.caption;
  $('#fcMini').innerHTML = fc.items.map((it) => `
    <div class="fc-item">
      <div class="fc-top"><span class="fc-name">${it.name}</span><span class="fc-pct">${pct(it.pct)}</span></div>
      <div class="fc-track"><i${fillClass(it.key)} style="width:${r1(it.pct * 2.5)}%"></i><span class="fc-goal" style="left:${r1(it.goal * 2.5)}%"></span></div>
      <div class="fc-sub">цель ${Math.round(it.goal)} % · <span class="${it.dir}">${signedPP(it.deltaPP)}</span></div>
    </div>`).join('');
}

function renderCategories(cats) {
  $('#categories').innerHTML = cats.map((c) => `
    <div class="cat"><div class="c-top"><b>${c.name}</b><span style="color:var(--mut)">${Math.round(c.pct)} %</span></div><div class="bar"><i${fillClass(c.key)} style="width:${c.pct}%"></i></div></div>`).join('');
}

function renderStock(s) {
  $('#stockTotal').textContent = money(s.total);
  $('#storeSplit').innerHTML = s.items.map((it) => `
    <div class="ss-row"><span>${it.name}</span><b>${money(it.value)}</b></div>
    <div class="ss-bar"><i${fillClass(it.key)} style="width:${r1(it.value / s.total * 100)}%"></i></div>`).join('');
}

/* ---------- график «Выручка по дням» + поповер дня ---------- */
function initDaysChart(days, max) {
  const svg = document.getElementById('daysChart');
  const W = 860, H = 230, pl = 46, pr = 10, pt = 14, pb = 28;
  const iw = W - pl - pr, ih = H - pt - pb;

  let s = `<defs>
    <linearGradient id="dayg" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#19A06B"/><stop offset="1" stop-color="#3DDC97"/></linearGradient>
  </defs>`;
  for (let i = 0; i <= 4; i++) {
    const y = pt + ih - ih * i / 4;
    s += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="#1B2236"/>`;
    s += `<text x="${pl - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#5A6480" font-family="Manrope">${max * i / 4 / 1000}к</text>`;
  }
  const slot = iw / days.length;
  days.forEach((d, i) => {
    const h = d.revenue / max * ih, x = pl + slot * i + slot * 0.2, w = slot * 0.6, y = pt + ih - h;
    const wknd = d.weekday === 5 || d.weekday === 6 || d.weekday === 0;
    s += `<rect class="dbar" data-i="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="5"
        fill="url(#dayg)" style="cursor:pointer"/>`;
    const py = pt + ih - d.plan / max * ih;
    s += `<line x1="${(x - 3).toFixed(1)}" y1="${py.toFixed(1)}" x2="${(x + w + 3).toFixed(1)}" y2="${py.toFixed(1)}" stroke="#5A6480" stroke-width="2" stroke-linecap="round" pointer-events="none"/>`;
    s += `<text x="${(pl + slot * i + slot / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="${wknd ? '#9D9BFF' : '#5A6480'}" font-family="Manrope">${d.day} ${WEEKDAYS_SHORT[d.weekday]}</text>`;
  });
  s += `<rect id="daySel" x="0" y="0" width="0" height="0" rx="5" fill="none" stroke="#6E6BFF" stroke-width="2" style="filter:drop-shadow(0 0 6px rgba(110,107,255,.7))" pointer-events="none" opacity="0"/>`;
  svg.innerHTML = s;

  const pop = document.createElement('div');
  pop.className = 'kpop day';
  document.body.appendChild(pop);
  let cur = null;

  function show(bar) {
    const d = days[+bar.dataset.i];
    const dp = (d.revenue - d.plan) / d.plan * 100;
    pop.innerHTML = `<h5>${d.day} июня · ${WEEKDAYS_FULL[d.weekday]}</h5>
      <div class="pr"><span>Выручка</span><b>${money(d.revenue)}</b></div>
      <div class="pr"><span>К плану дня (${money(d.plan)})</span><b class="${dp >= 0 ? 'up' : 'dn'}">${signedPct(dp)}</b></div>
      <div class="pr"><span>Чеки · средний чек</span><b>${d.checks} · ${money(d.avg)}</b></div>
      <div class="pr"><span>Гости</span><b>${fmt(d.guests)}</b></div>
      <div class="ft"><a href="#">Подробнее о дне →</a></div>`;
    const r = bar.getBoundingClientRect();
    pop.classList.add('show');
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
    pop.style.left = left + 'px';
    pop.style.top = (r.top - ph - 11) + 'px';
    pop.style.setProperty('--ax', (r.left + r.width / 2 - left - 5) + 'px');
    const sel = document.getElementById('daySel');
    ['x', 'y', 'width', 'height'].forEach((a) => sel.setAttribute(a, bar.getAttribute(a)));
    sel.setAttribute('opacity', '1');
    cur = bar;
  }
  function hideDay() {
    pop.classList.remove('show');
    document.getElementById('daySel').setAttribute('opacity', '0');
    cur = null;
  }

  svg.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = e.target;
    if (t.classList && t.classList.contains('dbar')) { cur === t ? hideDay() : show(t); }
    else hideDay();
  });
  document.addEventListener('click', hideDay);
  window.addEventListener('scroll', hideDay, { passive: true });
  pop.addEventListener('click', (e) => e.stopPropagation());
}

/* ---------- поповеры деталей метрик ---------- */
function initDetailPopovers(details) {
  const pop = document.createElement('div');
  pop.className = 'kpop';
  document.body.appendChild(pop);
  let hideT = null, current = null;

  function show(el) {
    const d = details[el.dataset.pop];
    if (!d) return;
    clearTimeout(hideT);
    current = el;
    pop.innerHTML = `<h5>${d.title}</h5>` +
      d.rows.map((r) => `<div class="pr"><span>${r[0]}</span><b class="${r[2] || ''}">${r[1]}</b></div>`).join('') +
      `<div class="ft">${d.footnote}</div>`;
    const r = el.getBoundingClientRect();
    pop.classList.add('show');
    const pw = pop.offsetWidth;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
    pop.style.left = left + 'px';
    pop.style.top = (r.bottom + 9) + 'px';
    pop.style.setProperty('--ax', (r.left + r.width / 2 - left - 5) + 'px');
  }
  function hide() {
    hideT = setTimeout(() => { pop.classList.remove('show'); current = null; }, 160);
  }

  document.querySelectorAll('[data-pop]').forEach((el) => {
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      current === el && pop.classList.contains('show')
        ? (pop.classList.remove('show'), current = null)
        : show(el);
    });
  });
  pop.addEventListener('mouseenter', () => clearTimeout(hideT));
  pop.addEventListener('mouseleave', hide);
  document.addEventListener('click', () => { pop.classList.remove('show'); current = null; });
  window.addEventListener('scroll', () => { pop.classList.remove('show'); }, { passive: true });
}

/* ---------- сборка ---------- */
function render(d) {
  renderHeader(d);
  renderKpis(d.kpis);
  renderReviews(d.reviews);
  renderFoodcostMini(d.foodcostMini);
  renderCategories(d.categories);
  renderStock(d.stock);
  initDaysChart(d.revenueByDay, d.revenueByDayMax);
  // поповеры — после KPI: они навешиваются на элементы [data-pop], созданные выше
  initDetailPopovers(d.details);
}

loadPage('dashboard', render);
