import { fmt, money } from '../format.js';
import { CAT_NAME, CAT_COLOR } from '../palette.js';
import { describeArc, shade } from '../charts.js';
import { loadPage } from '../api.js';

const $ = (sel) => document.querySelector(sel);

function render(data) {
  $('#asOfLabel').textContent = data.asOf.label;
  $('#asOfNote').textContent = data.asOf.note;

  // Сумма по позиции = кол-во × цена единицы (себестоимость).
  const STOCK = data.positions.map((p) => ({ ...p, sum: p.qty * p.price }));

  /* ===== общие запасы ===== */
  $('#totalValue').textContent = money(data.totals.value);
  $('#totalSub').textContent = `в себестоимости · ${data.totals.stores} склада`;
  $('#totalStores').innerHTML = data.totals.byStore.map((s) =>
    `<div class="store-row"><span class="store-dot" style="background:${CAT_COLOR[s.key]}"></span><span class="sn">${s.name}</span><b>${money(s.value)}</b></div>`).join('');

  /* ===== категории: донат / бары ===== */
  let level = 'cat';
  function aggCat() { const m = {}; STOCK.forEach((p) => { (m[p.store] = m[p.store] || 0); m[p.store] += p.sum; }); return m; }
  function renderDonut() {
    const m = aggCat();
    const items = ['k', 'b', 'w'].filter((c) => m[c]).map((c) => ({ key: c, name: CAT_NAME[c], color: CAT_COLOR[c], sum: m[c] }));
    const total = items.reduce((s, d) => s + d.sum, 0);
    const cx = 95, cy = 95, r = 70, sw = 26;
    let ang = 0, paths = '', defs = '';
    items.forEach((d, i) => {
      const sweep = d.sum / total * 360, start = ang, end = ang + sweep - 1.2; ang += sweep;
      defs += `<linearGradient id="sg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.color}"/><stop offset="1" stop-color="${shade(d.color, -30)}"/></linearGradient>`;
      paths += `<path class="donut-seg" data-key="${d.key}" d="${describeArc(cx, cy, r, start, end)}" fill="none" stroke="url(#sg${i})" stroke-width="${sw}"/>`;
    });
    $('#donut').innerHTML = `<defs>${defs}<radialGradient id="sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="0.72" stop-color="#000" stop-opacity="0.4"/><stop offset="0.75" stop-color="#000" stop-opacity="0"/></radialGradient></defs>${paths}<circle cx="95" cy="95" r="70" fill="none" stroke="url(#sh)" stroke-width="26" pointer-events="none"/>`;
    $('#donutCenter').innerHTML = `<div class="dc-label">Всего</div><div class="dc-val">${money(total)}</div>`;
    $('#legend').innerHTML = items.map((d) => `<div class="lg-row" data-key="${d.key}"><span class="lg-dot" style="background:${d.color}"></span><span class="lg-name">${d.name}<small>${(d.sum / total * 100).toFixed(0)} % запасов</small></span><span class="lg-val">${money(d.sum)}</span></div>`).join('');
  }
  function renderBars() {
    const m = {};
    STOCK.forEach((p) => { const key = p.store + '|' + p.sub; (m[key] = m[key] || { store: p.store, sub: p.sub, sum: 0 }); m[key].sum += p.sum; });
    const arr = Object.values(m); const max = Math.max(...arr.map((x) => x.sum));
    let html = '';
    ['k', 'b', 'w'].forEach((c) => {
      const items = arr.filter((x) => x.store === c).sort((a, b) => b.sum - a.sum); if (!items.length) return;
      html += `<div class="bar-group"><div class="bg-title" style="--cc:${CAT_COLOR[c]}">${CAT_NAME[c]}</div>`;
      items.forEach((x) => { html += `<div class="bar-row"><span class="br-name">${x.sub}</span><span class="br-track"><i style="width:${(x.sum / max * 100).toFixed(1)}%"></i></span><span class="br-val">${money(x.sum)}</span></div>`; });
      html += `</div>`;
    });
    $('#bars').innerHTML = html;
  }
  function renderCatBlock() {
    const isCat = level === 'cat';
    $('#donutWrap').style.display = isCat ? '' : 'none';
    $('#barsBlock').style.display = isCat ? 'none' : '';
    if (isCat) renderDonut(); else renderBars();
  }
  $('#levelSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#levelSeg button').forEach((x) => x.classList.toggle('on', x === b)); level = b.dataset.level; renderCatBlock(); });

  /* ===== динамика запасов (ряды приходят готовыми из data.dynamics) ===== */
  let store = 'all', freq = 'week';
  function renderChart() {
    const { labels, values: vals } = data.dynamics[store][freq];
    const W = 900, H = 280, pl = 70, pr = 20, pt = 20, pb = 34;
    const iw = W - pl - pr, ih = H - pt - pb;
    const max = Math.max(...vals) * 1.1, min = Math.min(...vals) * 0.85;
    const x = (i) => pl + iw * i / (vals.length - 1);
    const y = (v) => pt + ih - (v - min) / (max - min) * ih;
    let g = '';
    for (let i = 0; i <= 4; i++) { const gy = pt + ih * i / 4; const gv = max - (max - min) * i / 4; g += `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="#1B2236"/><text x="${pl - 8}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#5A6480" font-family="Manrope">${Math.round(gv / 1000)}к</text>`; }
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${pl},${pt + ih} ${pts} ${W - pr},${pt + ih}`;
    const col = store === 'all' ? '#6E6BFF' : CAT_COLOR[store];
    let dots = ''; vals.forEach((v, i) => { dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="#0D1220" stroke="${col}" stroke-width="2"/>`; });
    let xl = ''; labels.forEach((l, i) => { xl += `<text x="${x(i).toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#8590A8" font-family="Manrope">${l}</text>`; });
    $('#stockChart').innerHTML =
      `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".25"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
       ${g}<polygon points="${area}" fill="url(#area)"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5"/>${dots}${xl}`;
  }
  $('#storeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#storeSeg button').forEach((x) => x.classList.toggle('on', x === b)); store = b.dataset.store; renderChart(); });
  $('#freqSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#freqSeg button').forEach((x) => x.classList.toggle('on', x === b)); freq = b.dataset.freq; renderChart(); });

  /* ===== топ-20 ===== */
  let metric = 'money';
  function renderTop() {
    const sorted = [...STOCK].sort((a, b) => metric === 'money' ? b.sum - a.sum : b.qty - a.qty).slice(0, 20);
    const max = Math.max(...sorted.map((p) => metric === 'money' ? p.sum : p.qty));
    $('#topBars').innerHTML = sorted.map((p, i) => {
      const v = metric === 'money' ? p.sum : p.qty;
      const valTxt = metric === 'money' ? money(p.sum) : `${fmt(p.qty)} <small>${p.unit}</small>`;
      return `<div class="top-row">
        <span class="top-rank">${i + 1}</span>
        <span class="top-name">${p.name}</span>
        <span class="top-track ${p.store}"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span>
        <span class="top-val">${valTxt}</span>
      </div>`;
    }).join('');
  }
  $('#metricSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#metricSeg button').forEach((x) => x.classList.toggle('on', x === b)); metric = b.dataset.metric; renderTop(); });

  /* hover донат */
  function bindDonut() {
    const hl = (key) => document.querySelectorAll('.donut-seg').forEach((s) => s.classList.toggle('dim', key && s.dataset.key !== key));
    const lg = $('#legend'), dn = $('#donut');
    lg.addEventListener('mouseover', (e) => { const r = e.target.closest('.lg-row'); hl(r ? r.dataset.key : null); });
    lg.addEventListener('mouseleave', () => hl(null));
    dn.addEventListener('mouseover', (e) => { const s = e.target.closest('.donut-seg'); hl(s ? s.dataset.key : null); });
    dn.addEventListener('mouseleave', () => hl(null));
  }

  renderCatBlock();
  bindDonut();
  renderChart();
  renderTop();
}

loadPage('warehouse', render);
