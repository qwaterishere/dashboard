import { fmt, money, pct } from '../format.js';
import { CAT_NAME, CAT_COLOR } from '../palette.js';
import { describeArc, shade } from '../charts.js';
import { loadPage } from '../api.js';

const $ = (sel) => document.querySelector(sel);

function render(data) {
  $('#periodLabel').textContent = data.period.label;
  $('#periodNote').textContent = data.period.note;

  // Производные показатели считаем здесь: бэкенд присылает «сырьё»
  // (кол-во, цена, себестоимость единицы), выручку/прибыль/фудкост выводим.
  const RAW = data.positions.map((p) => {
    const rev = p.qty * p.price;
    const cost = p.qty * p.unitCost;
    return { name: p.name, sub: p.sub, cat: p.cat, qty: p.qty, rev, cost, gp: rev - cost, fc: cost / rev * 100 };
  });

  /* ===== агрегация ===== */
  function aggBy(key) {
    const m = {};
    RAW.forEach((p) => {
      const g = p[key];
      (m[g] = m[g] || { rev: 0, gp: 0, cost: 0, qty: 0 });
      m[g].rev += p.rev; m[g].gp += p.gp; m[g].cost += p.cost; m[g].qty += p.qty;
    });
    return m;
  }

  let level = 'cat';

  /* ===== донат (категории) ===== */
  function renderDonut() {
    const m = aggBy('cat');
    const data = ['k', 'b', 'w'].filter((c) => m[c]).map((c) => ({ key: c, name: CAT_NAME[c], color: CAT_COLOR[c], rev: m[c].rev, gp: m[c].gp }));
    const total = data.reduce((s, d) => s + d.rev, 0), totalGp = data.reduce((s, d) => s + d.gp, 0);
    const cx = 110, cy = 110, r = 82, sw = 30;
    let ang = 0, paths = '', defs = '';
    data.forEach((d, i) => {
      const sweep = d.rev / total * 360, start = ang, end = ang + sweep - (data.length > 1 ? 1.2 : 0); ang += sweep;
      defs += `<linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.color}"/><stop offset="1" stop-color="${shade(d.color, -30)}"/></linearGradient>`;
      paths += `<path class="donut-seg" data-key="${d.key}" d="${describeArc(cx, cy, r, start, end)}" fill="none" stroke="url(#g${i})" stroke-width="${sw}"/>`;
    });
    $('#donut').innerHTML = `<defs>${defs}<radialGradient id="innerShade" cx="0.5" cy="0.5" r="0.5"><stop offset="0.60" stop-color="#000" stop-opacity="0"/><stop offset="0.70" stop-color="#000" stop-opacity="0.4"/><stop offset="0.73" stop-color="#000" stop-opacity="0"/></radialGradient></defs>${paths}<circle cx="110" cy="110" r="82" fill="none" stroke="url(#innerShade)" stroke-width="30" pointer-events="none"/>`;
    $('#donutCenter').innerHTML = `<div class="dc-label">Выручка</div><div class="dc-val">${money(total)}</div><div class="dc-sub">прибыль ${money(totalGp)}</div>`;
    $('#legend').innerHTML =
      `<div class="lg-head"><span>Выручка</span><span>Вал. прибыль</span></div>` +
      data.map((d) => `<div class="lg-row" data-key="${d.key}">
        <span class="lg-dot" style="background:${d.color}"></span>
        <span class="lg-name">${d.name}<small>${(d.rev / total * 100).toFixed(0)} % от выручки</small></span>
        <span class="lg-vals"><b class="lg-r">${money(d.rev)}</b><b class="lg-g">${money(d.gp)}</b></span>
      </div>`).join('');
  }
  function bindDonutHover() {
    const hl = (key) => document.querySelectorAll('.donut-seg').forEach((s) => s.classList.toggle('dim', key && s.dataset.key !== key));
    const lg = $('#legend'), dn = $('#donut');
    lg.addEventListener('mouseover', (e) => { const r = e.target.closest('.lg-row'); hl(r ? r.dataset.key : null); });
    lg.addEventListener('mouseleave', () => hl(null));
    dn.addEventListener('mouseover', (e) => { const s = e.target.closest('.donut-seg'); hl(s ? s.dataset.key : null); });
    dn.addEventListener('mouseleave', () => hl(null));
  }

  /* ===== бары (подкатегории) ===== */
  function barData() {
    const groups = { k: [], b: [], w: [] };
    if (level === 'cat') {
      const m = aggBy('cat');
      ['k', 'b', 'w'].forEach((c) => { if (m[c]) groups[c].push({ name: CAT_NAME[c], rev: m[c].rev, gp: m[c].gp }); });
    } else {
      const m = {};
      RAW.forEach((p) => { const key = p.cat + '|' + p.sub; (m[key] = m[key] || { cat: p.cat, sub: p.sub, rev: 0, gp: 0 }); m[key].rev += p.rev; m[key].gp += p.gp; });
      Object.values(m).forEach((x) => groups[x.cat].push({ name: x.sub, rev: x.rev, gp: x.gp }));
      ['k', 'b', 'w'].forEach((c) => groups[c].sort((a, b) => b.rev - a.rev));
    }
    return groups;
  }
  function renderBars() {
    const g = barData();
    const all = [...g.k, ...g.b, ...g.w];
    const maxRev = Math.max(...all.map((x) => x.rev));
    const totalRev = all.reduce((s, x) => s + x.rev, 0);
    let html = '';
    ['k', 'b', 'w'].forEach((c) => {
      if (!g[c].length) return;
      html += `<div class="bar-group"><div class="bg-title" style="--cc:${CAT_COLOR[c]}">${CAT_NAME[c]}</div>`;
      g[c].forEach((x) => {
        const revW = x.rev / maxRev * 100, gpW = x.gp / maxRev * 100;
        const share = (x.rev / totalRev * 100).toFixed(1).replace('.', ',');
        html += `<div class="bar-row">
          <span class="br-name">${x.name}</span>
          <span class="br-track"><i class="br-rev" style="width:${revW.toFixed(1)}%"></i><i class="br-gp" style="width:${gpW.toFixed(1)}%"></i></span>
          <span class="br-vals"><b class="br-r">${money(x.rev)}</b><b class="br-g">${money(x.gp)}</b><small>${share} % от выручки</small></span>
        </div>`;
      });
      html += `</div>`;
    });
    $('#bars').innerHTML = html;
  }

  function renderStructure() {
    const isCat = level === 'cat';
    $('#donutWrap').style.display = isCat ? '' : 'none';
    $('#barsBlock').style.display = isCat ? 'none' : '';
    if (isCat) renderDonut(); else renderBars();
  }
  $('#levelSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#levelSeg button').forEach((x) => x.classList.toggle('on', x === b));
    level = b.dataset.level; renderStructure();
  });

  /* ===== ABC ===== */
  let abcAxis = 'gp', sortKey = 'gp', sortDesc = true;
  const abcFilter = { A: 1, B: 1, C: 1 };
  function computeABC() {
    const sorted = [...RAW].sort((a, b) => b[abcAxis] - a[abcAxis]);
    const total = sorted.reduce((s, p) => s + p[abcAxis], 0);
    let cum = 0;
    sorted.forEach((p) => { cum += p[abcAxis]; const share = cum / total; p.abc = share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C'; });
  }
  function renderSummary() {
    const g = { A: { n: 0, v: 0 }, B: { n: 0, v: 0 }, C: { n: 0, v: 0 } };
    const total = RAW.reduce((s, p) => s + p[abcAxis], 0);
    RAW.forEach((p) => { g[p.abc].n++; g[p.abc].v += p[abcAxis]; });
    const lbl = abcAxis === 'gp' ? 'прибыли' : 'выручки';
    $('#abcSummary').innerHTML = ['A', 'B', 'C'].map((L) =>
      `<div class="abc-pill ${L} ${abcFilter[L] ? '' : 'off'}" data-g="${L}">
        <span class="dot"></span><b>${L}</b>
        <span class="meta">${g[L].n} поз · ${(g[L].v / total * 100).toFixed(0)} % ${lbl}</span>
      </div>`).join('');
  }
  function renderTable() {
    const list = RAW.filter((p) => abcFilter[p.abc]);
    list.sort((a, b) => {
      let r;
      if (sortKey === 'name') r = a.name.localeCompare(b.name);
      else if (sortKey === 'abc') r = ('ABC'.indexOf(a.abc)) - ('ABC'.indexOf(b.abc));
      else r = a[sortKey] - b[sortKey];
      return sortDesc ? -r : r;
    });
    $('#posBody').innerHTML = list.map((p) => {
      const fcCls = p.fc < 28 ? 'lo' : p.fc > 33 ? 'hi' : '';
      return `<tr>
        <td class="pos-name">${p.name}<small>${p.sub} · ${CAT_NAME[p.cat]}</small></td>
        <td><span class="abc-tag ${p.abc}">${p.abc}</span></td>
        <td>${fmt(p.qty)}</td>
        <td>${money(p.rev)}</td>
        <td class="gp-cell">${money(p.gp)}</td>
        <td class="fc-cell ${fcCls}">${pct(p.fc)}</td>
      </tr>`;
    }).join('');
    document.querySelectorAll('#posHead th').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.k === sortKey);
      const arr = th.querySelector('.arr'); if (arr) arr.textContent = sortDesc ? '▾' : '▴';
    });
  }
  function refreshABC() { computeABC(); renderSummary(); renderTable(); }

  $('#abcAxis').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#abcAxis button').forEach((x) => x.classList.toggle('on', x === b));
    abcAxis = b.dataset.axis; refreshABC();
  });
  $('#posHead').addEventListener('click', (e) => {
    const th = e.target.closest('th'); if (!th) return;
    const key = th.dataset.k;
    if (sortKey === key) sortDesc = !sortDesc; else { sortKey = key; sortDesc = (key !== 'name'); }
    renderTable();
  });
  $('#abcSummary').addEventListener('click', (e) => {
    const p = e.target.closest('.abc-pill'); if (!p) return;
    const L = p.dataset.g; abcFilter[L] = !abcFilter[L];
    if (!Object.values(abcFilter).some((v) => v)) abcFilter[L] = true; // не дать выключить все
    renderSummary(); renderTable();
  });

  renderStructure();
  bindDonutHover();
  refreshABC();
}

loadPage('sales', render);
