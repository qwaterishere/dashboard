import { fmt, money, pct, signedPct } from '../format.js';
import { loadPage } from '../api.js';

const $ = (sel) => document.querySelector(sel);
const lfl = (l) => `<span class="lfl ${l.dir}">LfL ${signedPct(l.pct)}</span>`;

function render(data) {
  $('#periodLabel').textContent = data.period.label;
  $('#periodNote').textContent = data.period.note;
  $('#compareWith').textContent = data.period.compareWith;

  /* ===== две большие карточки ===== */
  const { clean, dirty } = data.overview;
  $('#cleanCard').innerHTML = `
    <div class="bc-head">
      <div class="bc-title">${clean.title} <span class="tag">${clean.tag}</span></div>
      ${lfl(clean.lfl)}
    </div>
    <div class="bc-sub">${clean.subtitle}</div>
    <div class="bc-main">
      <span class="bc-pct">${pct(clean.pct)}</span>
      <div class="bc-meta">
        <span>цель <b>${pct(clean.goal)}</b></span>
        <span>себестоимость <b>${money(clean.cost)}</b></span>
        <span>выручка <b>${money(clean.revenue)}</b></span>
      </div>
    </div>`;
  $('#dirtyCard').innerHTML = `
    <div class="bc-head">
      <div class="bc-title">${dirty.title} <span class="tag">${dirty.tag}</span></div>
      ${lfl(dirty.lfl)}
    </div>
    <div class="bc-sub">${dirty.subtitle}</div>
    <div class="bc-main">
      <span class="bc-pct">${pct(dirty.pct)}</span>
      <div class="bc-meta">
        <span>цель <b>${pct(dirty.goal)}</b></span>
        <span>расход продуктов <b>${money(dirty.cost)}</b></span>
        <span>сверх продаж <b style="color:var(--amber)">+${money(dirty.overSales)}</b></span>
      </div>
    </div>`;

  /* ===== три подразделения ===== */
  $('#units').innerHTML = data.units.map((u) => {
    const over = u.pct > u.goal;
    const dev = (u.pct - u.goal) / u.goal * 100;
    return `<div class="unit ${u.key}">
      <div class="u-head"><span class="u-name">${u.name}</span>${lfl(u.lfl)}</div>
      <div class="u-pct"><span class="v">${pct(u.pct)}</span></div>
      <div class="u-rows">
        <div class="u-row"><span>Цель</span><b>${pct(u.goal)} · <span class="${over ? 'goal-bad' : 'goal-ok'}">${signedPct(dev)}</span></b></div>
        <div class="u-row"><span>Себестоимость</span><b>${money(u.cost)}</b></div>
        <div class="u-row"><span>Доля в расходе</span><b>${pct(u.shareOfSpend)}</b></div>
      </div>
    </div>`;
  }).join('');

  /* ===== потери: факт и цель ===== */
  $('#lossBody').innerHTML = data.losses.rows.map((r) => `
    <tr>
      <td><span class="lt-name">${r.name}</span><small>${r.note}</small></td>
      <td class="num">${money(r.fact)}</td>
      <td class="num goal">${money(r.goal)}</td>
    </tr>`).join('');
  $('#lossFoot').innerHTML = `
    <tr>
      <td><span class="lt-name">Итого</span></td>
      <td class="num">${money(data.losses.total.fact)}</td>
      <td class="num goal">${money(data.losses.total.goal)}</td>
    </tr>`;

  /* ===== скидки ===== */
  $('#discGrid').innerHTML = data.discounts.map((d) => `
    <div class="disc-cell">
      <div class="dc-label">${d.label}</div>
      <div class="dc-val${d.tone ? ' ' + d.tone : ''}">${d.value}</div>
      <div class="dc-cap">${d.caption}</div>
    </div>`).join('');

  /* ===== фудкост по категориям ===== */
  function renderCat(unit) {
    $('#catBody').innerHTML = data.categories[unit].map((c) => {
      const over = c.fact > c.goal;
      const dev = (c.fact - c.goal) / c.goal * 100;
      return `<tr>
        <td><span class="lt-name">${c.name}</span></td>
        <td class="num fc-pct ${over ? 'over' : ''}">${pct(c.fact)}</td>
        <td class="num goal">${pct(c.goal)}</td>
        <td class="num ${over ? 'bad' : 'ok'}">${signedPct(dev)}</td>
        <td class="num">${money(c.cost)}</td>
      </tr>`;
    }).join('');
  }
  renderCat('k');
  $('#catTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.ct-tab'); if (!b) return;
    document.querySelectorAll('#catTabs .ct-tab').forEach((x) => x.classList.toggle('on', x === b));
    renderCat(b.dataset.unit);
  });

  /* ===== чарт продуктов по фудкосту ===== */
  const PRODUCTS = data.products.map((p) => ({
    n: p.name, g: p.group, price: p.price, cost: p.cost,
    fc: p.cost / p.price * 100, margin: p.price - p.cost,
  }));
  const pcChart = $('#pcChart');
  const pcTip = $('#pcTip');
  let pcGroup = 'all';

  function renderChart() {
    const list = PRODUCTS.filter((p) => pcGroup === 'all' || p.g === pcGroup);
    const sorted = [...list].sort((a, b) => a.fc - b.fc);
    const good = sorted.slice(0, 10);
    const bad = sorted.slice(-10).reverse();
    const maxPrice = Math.max(...good.concat(bad).map((p) => p.price));
    const bar = (p, cls) => {
      const H = 250;
      const h = Math.max(p.price / maxPrice * H, 4);
      const costH = p.cost / p.price * h;
      return `<span class="pc-bar ${cls}" data-n="${p.n}" data-price="${p.price}" data-cost="${p.cost}" data-fc="${p.fc.toFixed(1)}" data-m="${p.margin}">
        <span class="pc-fc">${p.fc.toFixed(0)}%</span>
        <span class="pc-col" style="height:${h.toFixed(0)}px">
          <span class="pc-cost" style="height:${costH.toFixed(0)}px"></span>
        </span>
        <span class="pc-name">${p.n}</span>
      </span>`;
    };
    pcChart.innerHTML =
      good.map((p) => bar(p, 'good')).join('') +
      '<div class="pc-divider"></div>' +
      bad.map((p) => bar(p, 'bad')).join('');
  }
  renderChart();
  $('#pcGroup').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#pcGroup button').forEach((x) => x.classList.toggle('on', x === b));
    pcGroup = b.dataset.g; renderChart();
  });

  pcChart.addEventListener('mousemove', (e) => {
    const bar = e.target.closest('.pc-bar');
    if (!bar) { pcTip.style.opacity = 0; return; }
    const price = +bar.dataset.price, cost = +bar.dataset.cost, m = +bar.dataset.m, fc = bar.dataset.fc;
    pcTip.innerHTML = `<b>${bar.dataset.n}</b>
      <div class="row"><span>Цена</span><b>${fmt(price)} ₽</b></div>
      <div class="row"><span>Себестоимость</span><b>${fmt(cost)} ₽</b></div>
      <div class="row"><span>Наценка</span><b>${fmt(m)} ₽</b></div>
      <div class="row"><span>Фудкост</span><b>${fc.replace('.', ',')} %</b></div>`;
    const r = bar.getBoundingClientRect(), wr = pcChart.parentElement.getBoundingClientRect();
    pcTip.style.left = (r.left - wr.left + r.width / 2) + 'px';
    pcTip.style.top = (r.top - wr.top) + 'px';
    pcTip.style.opacity = 1;
  });
  pcChart.addEventListener('mouseleave', () => (pcTip.style.opacity = 0));
}

loadPage('foodcost', render);
