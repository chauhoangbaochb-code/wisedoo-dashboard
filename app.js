/* WisEdoo — Registration dashboard (đọc trực tiếp Google Sheet, tự làm mới) */
(() => {
  'use strict';

  const CFG = window.DASHBOARD_CONFIG;
  const DAY = 86400000;
  const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];      // theo Date.getDay()
  const DOW_ROWS = [1, 2, 3, 4, 5, 6, 0];                         // hiển thị T2 → CN
  const SOURCE_ORDER = ['facebook', 'zalo', 'email', 'direct', 'tiktok', 'google', 'youtube', 'instagram', 'linkedin'];
  const UNKNOWN = '(Không rõ)';
  const NOT_MANAGING = 'Chưa trực tiếp phụ trách ai';
  const SENIOR_EXP = ['3 - 5 năm', 'Trên 5 năm'];
  const COHORTS = ['Từ 2005', '2000–2004', '1995–1999', '1990–1994', '1985–1989', 'Trước 1985'];
  const NOW_YEAR = new Date().getFullYear();

  const PHRASES = [
    'tình nguyện viên', 'micro manage', 'follow up', 'core team', 'nhân sự', 'nhân viên', 'giao việc', 'công việc', 'khó khăn', 'hiệu quả',
    'tiến độ', 'chủ động', 'trì hoãn', 'giữ chân', 'gắn kết', 'giữ lửa', 'quá tải', 'đội ngũ', 'đội nhóm',
    'theo dõi', 'kiểm soát', 'tuyển dụng', 'động lực', 'vai trò', 'hoạch định', 'quyết định', 'deadline', 'kết quả',
    'dự án', 'thành viên', 'trách nhiệm', 'cam kết', 'phát triển', 'kế hoạch', 'ưu tiên', 'thời gian', 'đánh giá',
    'phản hồi', 'giao tiếp', 'truyền đạt', 'lãnh đạo', 'dẫn dắt', 'quản lý', 'thực hiện sai', 'hối thúc', 'cùng lúc',
    'rời đi', 'nghỉ việc', 'tuyển', 'mô tả', 'chỉ thị', 'thực hành', 'đóng góp', 'ý tưởng', 'lợi nhuận', 'hướng dẫn',
  ].sort((a, b) => b.length - a.length);
  // cụm từ quá chung chung — vẫn cắt khỏi câu nhưng không hiện trên word cloud
  const GENERIC = new Set(['công việc', 'khó khăn', 'hiệu quả', 'quản lý', 'nhân viên', 'nhân sự']);
  const STOP = new Set(('và của cho các những là có không được trong với mình em tôi anh chị bạn thì mà này đó để khi ' +
    'như nhưng vẫn đã đang sẽ rất cũng ra vào lại nên về từ một nhiều mọi gì ạ nhé ở theo hay hoặc bị cách làm thế ' +
    'nào sao chưa họ ai rằng vì nó đây kia đến hơn mỗi từng tìm muốn thấy gặp phải dù đều thường gần ví dụ như là ' +
    'người việc cả chỉ hiện nay đâu nữa lúc vừa còn tại chính mà do qua sự hơi khá').split(' '));

  /* ---------------- helpers ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);
  const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const keyOf = s => clean(s).toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
  const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayLabel = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
  const eventTitle = ev => (CFG.events && CFG.events[ev] && CFG.events[ev].title) || ev;
  const top = m => { let best = null; for (const [k, v] of m) if (k !== UNKNOWN && (!best || v > best[1])) best = [k, v]; return best; };

  function parseCSV(text) {
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function parseTs(s) {
    s = clean(s);
    let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (m) return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (m) return new Date(+m[3], m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
    return null;
  }

  function parseSession(s) {
    s = clean(s);
    if (!s) return { label: '', date: null, time: '' };
    const d = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    const t = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.exec(s);
    let date = null;
    if (d) {
      const [hh, mm] = t ? t[1].split(':').map(Number) : [0, 0];
      date = new Date(+d[3], d[2] - 1, +d[1], hh, mm);
    }
    return { label: s, date, time: t ? `${t[1]}–${t[2]}` : '' };
  }

  function canonOrdered(v, list) {
    const k = keyOf(v);
    if (!k) return '';
    return list.find(x => keyOf(x) === k) || clean(v);
  }

  function industriesOf(raw) {
    const c = clean(raw);
    if (!c) return [];
    const alias = CFG.industryAliases || {};
    if (alias[c.toLowerCase()]) return [alias[c.toLowerCase()]];
    const parts = c.split(/\s*[,;/]\s*/).map(p => p.trim().toLowerCase()).filter(Boolean);
    return [...new Set(parts.map(k => alias[k] || capFirst(k)))];
  }

  function isNoConcern(q) {
    const t = clean(q).toLowerCase().replace(/[.!…,;:()"'-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return true;
    if (t.length < 60 && /(chưa|không)\s+(gặp|có)\s+(khó khăn|vấn đề|câu hỏi|gì)/.test(t)) return true;
    if (t.length <= 16 && /^(không|ko|k|chưa|no|none|n\/a|hiện chưa|chưa có|không có)\b/.test(t)) return true;
    return false;
  }

  function themesOf(q) {
    const t = clean(q).toLowerCase();
    const ids = CFG.themes.filter(th => th.keywords.some(k => t.includes(k))).map(th => th.id);
    return ids.length ? ids : ['other'];
  }
  const themeColor = id => { const i = CFG.themes.findIndex(t => t.id === id); return i >= 0 && i < 8 ? `--c${i + 1}` : '--c-other'; };
  const themeLabel = id => (id === 'other' ? 'Khác / chưa phân loại' : (CFG.themes.find(t => t.id === id) || {}).label || id);

  function cohortOf(y) {
    if (!y) return '';
    if (y < 1985) return 'Trước 1985';
    if (y < 1990) return '1985–1989';
    if (y < 1995) return '1990–1994';
    if (y < 2000) return '1995–1999';
    if (y < 2005) return '2000–2004';
    return 'Từ 2005';
  }
  function cohortSub(label) {
    const m = /(\d{4})–(\d{4})/.exec(label);
    if (m) return `${NOW_YEAR - +m[2]}–${NOW_YEAR - +m[1]} tuổi`;
    if (label === 'Trước 1985') return `trên ${NOW_YEAR - 1985} tuổi`;
    if (label === 'Từ 2005') return `dưới ${NOW_YEAR - 2004} tuổi`;
    return '';
  }

  /* ---------------- data model ---------------- */
  function toRecord(r, C, src) {
    const g = k => (C[k] == null ? '' : clean(r[C[k]]));
    const ts = parseTs(g('timestamp'));
    if (!ts) return null; // dòng tiêu đề / dòng trống
    const order = CFG.order || {};
    const question = String(C.question == null ? '' : r[C.question] ?? '').trim();
    const by = parseInt(g('birthYear'), 10);
    const birthYear = by >= 1940 && by <= NOW_YEAR - 14 ? by : null;
    const consentRaw = g('consent').toLowerCase();
    const consent = /^(yes|có|đồng ý|true|1|x)$/.test(consentRaw) ? 'yes' : /^(no|không|false|0)$/.test(consentRaw) ? 'no' : '';
    const session = parseSession(g('session'));
    const email = g('email').toLowerCase();
    const phone = g('phone').replace(/\D/g, '').replace(/^84/, '').replace(/^0/, '');
    const noConcern = isNoConcern(question);
    const validIds = CFG.themes.map(t => t.id).concat('other');
    const aiThemes = g('aiThemes').split(',').map(x => x.trim()).filter(x => validIds.includes(x));
    const aiKeywords = g('aiKeywords').split(';').map(x => x.trim().toLowerCase()).filter(Boolean);
    const byAi = !noConcern && aiThemes.length > 0;
    return {
      id: `${g('timestamp')}|${email}|${g('event')}`,
      ts, day: dayKey(ts),
      event: g('event') || src.label || 'Sự kiện',
      session,
      personKey: email || phone || keyOf(g('name')),
      email, phone,
      birthYear, cohort: cohortOf(birthYear),
      position: g('position'),
      industries: g('aiIndustry') ? [g('aiIndustry')] : industriesOf(g('industry')),
      industryRaw: g('industry'), industryByAi: !!g('aiIndustry'),
      teamSize: canonOrdered(g('teamSize'), order.teamSize || []),
      mgmtExp: canonOrdered(g('mgmtExp'), order.mgmtExp || []),
      question, noConcern,
      themes: noConcern ? [] : byAi ? aiThemes : themesOf(question),
      byAi, aiKeywords: byAi ? aiKeywords : [],
      consent,
      source: g('utmSource').toLowerCase(),
      campaign: g('utmCampaign'),
      city: C.city == null ? null : g('city'),
    };
  }

  async function fetchSource(src) {
    const base = `https://docs.google.com/spreadsheets/d/${CFG.sheetId}`;
    const urls = [
      `${base}/export?format=csv&gid=${src.gid}`,
      `${base}/gviz/tq?tqx=out:csv&headers=0&gid=${src.gid}`,
    ];
    let lastErr;
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (/^\s*</.test(text)) throw new Error('Sheet chưa được chia sẻ "Bất kỳ ai có đường liên kết"');
        return parseCSV(text);
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  // Apps Script Web App trả về { sheets: [{ gid, name, rows }] } — đã ẩn tên/email/SĐT
  async function fetchAppsScript() {
    const url = CFG.appsScriptUrl + (CFG.appsScriptUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('Apps Script không trả về JSON — kiểm tra quyền truy cập Web App là "Anyone"'); }
    state.summaries = data.summaries || {};
    return (data.sheets || []).map(sh => {
      const src = CFG.sources.find(x => String(x.gid) === String(sh.gid) || x.label === sh.name) || { label: sh.name };
      const columns = { ...(src.columns || CFG.columns) };
      if (sh.aiCols) { columns.aiThemes = sh.aiCols.themes; columns.aiKeywords = sh.aiCols.keywords; columns.aiIndustry = sh.aiCols.industry; }
      return { src: { ...src, columns }, rows: sh.rows || [] };
    });
  }

  /* ---------------- state ---------------- */
  const freshFilters = () => ({ source: '', position: '', mgmtExp: '', session: '' });
  const state = {
    all: [], events: [], byEvent: new Map(),
    route: readRoute(),
    filters: freshFilters(),
    q: { theme: null, word: null, hideEmpty: true },
    matrixDim: 'mgmtExp',
    summaries: {},
    lastFetch: null, lastHash: null, knownIds: null, error: null, loading: false,
    sourceColor: new Map(), eventColor: new Map(),
  };
  let charts = [];

  function readRoute() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    return h.startsWith('/event/') ? { view: 'event', event: h.slice(7) } : { view: 'overview' };
  }

  function ingest(recs) {
    state.all = recs;
    state.byEvent = new Map();
    for (const r of recs) {
      if (!state.byEvent.has(r.event)) state.byEvent.set(r.event, []);
      state.byEvent.get(r.event).push(r);
    }
    state.events = [...state.byEvent.keys()];
    state.events.forEach((ev, i) => state.eventColor.set(ev, `--c${(i % 8) + 1}`));
    const srcCounts = countBy(recs, r => r.source || UNKNOWN);
    const sources = [...srcCounts.keys()].sort((a, b) => {
      const ia = SOURCE_ORDER.indexOf(a), ib = SOURCE_ORDER.indexOf(b);
      if (a === UNKNOWN) return 1; if (b === UNKNOWN) return -1;
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return srcCounts.get(b) - srcCounts.get(a);
    });
    state.sourceColor = new Map();
    sources.forEach((s, i) => state.sourceColor.set(s, s === UNKNOWN || i >= 7 ? '--c-other' : `--c${i + 1}`));
  }

  async function load() {
    if (state.loading) return;
    state.loading = true; setLive();
    try {
      const results = CFG.appsScriptUrl
        ? await fetchAppsScript()
        : await Promise.all(CFG.sources.map(async src => ({ src, rows: await fetchSource(src) })));
      const recs = [];
      let raw = '';
      for (const { src, rows } of results) {
        raw += JSON.stringify(rows);
        for (const r of rows) { const rec = toRecord(r, src.columns || CFG.columns, src); if (rec) recs.push(rec); }
      }
      recs.sort((a, b) => a.ts - b.ts);
      raw += JSON.stringify(state.summaries);
      state.lastFetch = new Date(); state.error = null;
      const h = hashStr(raw);
      if (h !== state.lastHash) {
        const fresh = state.knownIds ? recs.filter(r => !state.knownIds.has(r.id)) : [];
        state.knownIds = new Set(recs.map(r => r.id));
        state.lastHash = h;
        ingest(recs);
        render(true);
        if (fresh.length) toast(`🎉 +${fresh.length} đăng ký mới · ${fresh.map(r => eventTitle(r.event)).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`);
      }
    } catch (e) {
      console.error(e);
      state.error = e;
      if (!state.all.length) $('#view').innerHTML = `<div class="state"><h2>Không đọc được dữ liệu</h2><p>${esc(e.message)}</p>
        <p>${CFG.appsScriptUrl ? 'Kiểm tra: Web App Apps Script đã triển khai với quyền <b>“Anyone”</b> và URL trong config.js đúng.' : 'Kiểm tra: Google Sheet đã bật chia sẻ <b>“Bất kỳ ai có đường liên kết — Người xem”</b>.'} Máy cần có Internet.</p></div>`;
    }
    state.loading = false; setLive();
  }

  function setLive() {
    const live = $('#live'), el = $('#lastUpdated');
    live.classList.toggle('err', !!state.error);
    if (state.loading && !state.lastFetch) { el.textContent = 'Đang tải dữ liệu…'; return; }
    if (state.error) { el.textContent = `Lỗi kết nối — thử lại sau ${CFG.refreshSeconds}s`; return; }
    if (!state.lastFetch) return;
    const s = Math.round((Date.now() - state.lastFetch) / 1000);
    const ago = s < 10 ? 'vừa xong' : s < 60 ? `${s} giây trước` : `${Math.round(s / 60)} phút trước`;
    el.textContent = `${state.loading ? 'Đang cập nhật… · ' : ''}Cập nhật ${ago} · tự làm mới mỗi ${CFG.refreshSeconds}s`;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 5000);
  }

  /* ---------------- aggregation ---------------- */
  function countBy(rows, fn) {
    const m = new Map();
    for (const r of rows) {
      const v = fn(r);
      for (const x of Array.isArray(v) ? v : [v]) {
        const k = x === '' || x == null ? UNKNOWN : x;
        m.set(k, (m.get(k) || 0) + 1);
      }
    }
    return m;
  }

  function toItems(m, order) {
    const items = [...m].map(([label, value]) => ({ label, value }));
    const rank = l => { if (l === UNKNOWN) return 1e9; const i = order ? order.indexOf(l) : -1; return i === -1 ? 1e6 : i; };
    if (order) items.sort((a, b) => rank(a.label) - rank(b.label) || b.value - a.value);
    else items.sort((a, b) => (a.label === UNKNOWN) - (b.label === UNKNOWN) || b.value - a.value || a.label.localeCompare(b.label, 'vi'));
    return items;
  }

  const isManaging = r => r.teamSize && r.teamSize !== NOT_MANAGING;
  const isSenior = r => SENIOR_EXP.includes(r.mgmtExp);

  function eventDates(rows) {
    const ds = rows.map(r => r.session.date).filter(Boolean).sort((a, b) => a - b);
    return { start: ds[0] || null, end: ds[ds.length - 1] || null };
  }

  function last24(rows) {
    const now = Date.now();
    return {
      cur: rows.filter(r => now - r.ts < DAY).length,
      prev: rows.filter(r => now - r.ts >= DAY && now - r.ts < 2 * DAY).length,
    };
  }

  function duplicates(rows) {
    const seen = new Map(); let dup = 0;
    for (const r of rows) {
      const k = `${r.event}|${r.personKey}`;
      if (!r.personKey) continue;
      if (seen.has(k)) dup++; else seen.set(k, 1);
    }
    return dup;
  }

  function keywords(rows) {
    const df = new Map();
    for (const r of rows) {
      if (r.noConcern) continue;
      if (r.aiKeywords.length) { for (const k of new Set(r.aiKeywords)) df.set(k, (df.get(k) || 0) + 1); continue; }
      let t = ' ' + r.question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' | ').replace(/\s+/g, ' ') + ' ';
      const found = new Set();
      for (const p of PHRASES) {
        if (t.includes(` ${p} `)) { found.add(p); t = t.split(` ${p} `).join(' | '); }
      }
      for (const seg of t.split('|')) {
        const w = seg.trim().split(' ').filter(Boolean);
        for (let i = 0; i < w.length - 1; i++) {
          if (STOP.has(w[i]) || STOP.has(w[i + 1]) || w[i].length < 2 || w[i + 1].length < 2) continue;
          found.add(`${w[i]} ${w[i + 1]}`);
        }
      }
      for (const k of found) df.set(k, (df.get(k) || 0) + 1);
    }
    const dict = new Set(PHRASES);
    for (const r of rows) r.aiKeywords.forEach(k => dict.add(k));
    const minAuto = rows.length >= 40 ? 3 : 2;
    return [...df].filter(([k, v]) => !GENERIC.has(k) && (dict.has(k) || v >= minAuto))
      .sort((a, b) => b[1] - a[1]).slice(0, 45)
      .map(([word, value]) => ({ word, value }));
  }

  /* ---------------- components ---------------- */
  function barList(items, { total, limit = 12, click, selected, subFn, colorFn, foldLabel = 'Khác' } = {}) {
    if (!items.length) return '<div class="empty">Chưa có dữ liệu</div>';
    let list = items;
    if (items.length > limit) {
      const rest = items.slice(limit - 1);
      list = items.slice(0, limit - 1).concat([{ label: `${foldLabel} (${rest.length} mục)`, value: rest.reduce((s, x) => s + x.value, 0), folded: true }]);
    }
    const max = Math.max(...list.map(i => i.value), 1);
    return `<div class="bars">${list.map(i => {
      const sub = subFn ? subFn(i) : '';
      const clickable = click && !i.folded && i.key !== undefined;
      const tip = `${i.label}: ${fmt(i.value)} người${total ? ` (${pct(i.value, total)}%)` : ''}`;
      return `<div class="bar-row${clickable ? ' clickable' : ''}${clickable && selected === i.key ? ' selected' : ''}"
        ${clickable ? `data-${click}="${esc(i.key)}" role="button" tabindex="0"` : ''} data-tip="${esc(tip)}">
        <div class="b-label">${esc(i.label)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
        <div class="b-track"><div class="b-fill" style="width:${(i.value / max) * 100}%${colorFn ? `;background:var(${colorFn(i)})` : ''}"></div></div>
        <div class="b-val">${fmt(i.value)}${total ? `<small>${pct(i.value, total)}%</small>` : ''}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function seqStep(v, max) { return v <= 0 ? 0 : Math.max(1, Math.min(6, Math.ceil((v / max) * 6))); }

  function heatmap(rows) {
    const grid = DOW_ROWS.map(() => new Array(24).fill(0));
    for (const r of rows) grid[DOW_ROWS.indexOf(r.ts.getDay())][r.ts.getHours()]++;
    const max = Math.max(1, ...grid.flat());
    let html = '<div class="heat-wrap"><div class="heat"><div></div>';
    for (let h = 0; h < 24; h++) html += `<div class="hh">${h % 3 === 0 ? h + 'h' : ''}</div>`;
    DOW_ROWS.forEach((d, ri) => {
      html += `<div class="hl">${DOW[d]}</div>`;
      for (let h = 0; h < 24; h++) {
        const v = grid[ri][h];
        html += `<div class="cell" style="background:var(--seq-${seqStep(v, max)})" data-tip="${DOW[d]} · ${h}h–${h + 1}h: ${v} đăng ký"></div>`;
      }
    });
    html += '</div></div>';
    html += `<div class="scale">Ít ${[0, 1, 2, 3, 4, 5, 6].map(i => `<i style="background:var(--seq-${i})"></i>`).join('')} Nhiều <span style="margin-left:auto">Cao nhất: ${max}/ô</span></div>`;
    return html;
  }

  function matrix(rowItems, colItems, cellFn, { rowClick } = {}) {
    if (!rowItems.length || !colItems.length) return '<div class="empty">Chưa có dữ liệu</div>';
    const cells = rowItems.map(ri => colItems.map(ci => cellFn(ri.key ?? ri.label, ci.key ?? ci.label)));
    const max = Math.max(1, ...cells.flat());
    const colTot = colItems.map((_, j) => cells.reduce((s, row) => s + row[j], 0));
    let html = '<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>';
    html += colItems.map(c => `<th>${esc(c.label)}</th>`).join('') + '<th>Tổng</th></tr></thead><tbody>';
    rowItems.forEach((ri, i) => {
      const rowTot = cells[i].reduce((a, b) => a + b, 0);
      html += `<tr><th class="rh" title="${esc(ri.label)}" ${rowClick ? `data-${rowClick}="${esc(ri.key)}" style="cursor:pointer"` : ''}>${esc(ri.label)}</th>`;
      cells[i].forEach((v, j) => {
        const st = seqStep(v, max);
        html += `<td class="v" style="background:var(--seq-${st});color:${st >= 4 ? 'var(--on-seq-hi)' : 'var(--text-2)'}"
          data-tip="${esc(`${ri.label} × ${colItems[j].label}: ${v} người${colTot[j] ? ` (${pct(v, colTot[j])}% của cột)` : ''}`)}">${v || ''}</td>`;
      });
      html += `<td class="tot">${rowTot}</td></tr>`;
    });
    return html + '</tbody></table></div>';
  }

  function legend(entries) {
    return `<div class="legend">${entries.map(e => `<span><i style="background:var(${e.color})"></i>${esc(e.label)}</span>`).join('')}</div>`;
  }

  function card(title, hint, body, cls = '') {
    return `<div class="card ${cls}"><h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}${body}</div>`;
  }

  function section(num, title, desc, body) {
    return `<section class="section"><div class="section-head"><h2><span class="num">${typeof num === 'number' ? `${num}.` : num}</span> ${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>${body}</section>`;
  }

  function kpi(label, value, sub, hero) {
    return `<div class="kpi${hero ? ' hero' : ''}"><div class="k-label">${label}</div><div class="k-value">${value}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}</div>`;
  }

  /* ---------------- charts (Chart.js) ---------------- */
  function chartBase() {
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#07070A', titleColor: '#fff', bodyColor: '#fff', footerColor: '#fff',
          padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
          titleFont: { family: 'Quicksand', weight: '700' }, bodyFont: { family: 'Quicksand' }, footerFont: { family: 'Quicksand', weight: '700' },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: cssVar('--line') }, ticks: { color: cssVar('--muted'), font: { family: 'Quicksand', size: 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } },
        y: { beginAtZero: true, grid: { color: cssVar('--line-soft') }, border: { display: false }, ticks: { color: cssVar('--muted'), font: { family: 'Quicksand', size: 11 }, precision: 0 } },
      },
    };
  }

  function dayRange(rows, endCap) {
    const first = startOfDay(rows[0].ts);
    const lastReg = startOfDay(rows[rows.length - 1].ts);
    let end = startOfDay(new Date());
    if (endCap && endCap < end) end = startOfDay(endCap);
    if (lastReg > end) end = lastReg;
    const days = [];
    for (let d = first; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(d);
    return days;
  }

  function dailyStacked(canvas, rows, groupFn, groups, colorOf, endCap) {
    if (!rows.length) return;
    const days = dayRange(rows, endCap);
    const idx = new Map(days.map((d, i) => [dayKey(d), i]));
    const surface = cssVar('--surface');
    const datasets = groups.map(gname => {
      const data = new Array(days.length).fill(0);
      for (const r of rows) if (groupFn(r) === gname && idx.has(r.day)) data[idx.get(r.day)]++;
      return { label: gname, data, backgroundColor: cssVar(colorOf(gname)), borderColor: surface, borderWidth: { top: 2 }, borderSkipped: 'bottom', borderRadius: 3, maxBarThickness: 28 };
    });
    const totals = days.map((_, i) => datasets.reduce((s, d) => s + d.data[i], 0));
    const cum = []; totals.reduce((s, v, i) => (cum[i] = s + v), 0);
    const opt = chartBase();
    opt.scales.x.stacked = true; opt.scales.y.stacked = true;
    opt.plugins.tooltip.filter = item => item.raw > 0;
    opt.plugins.tooltip.usePointStyle = false;
    opt.plugins.tooltip.callbacks = {
      title: items => { if (!items.length) return ''; const d = days[items[0].dataIndex]; return `${DOW[d.getDay()]}, ${dayLabel(d)}/${d.getFullYear()}`; },
      footer: items => { if (!items.length) return ''; const i = items[0].dataIndex; return `Tổng ngày: ${totals[i]} · Luỹ kế: ${cum[i]}`; },
    };
    charts.push(new Chart(canvas, { type: 'bar', data: { labels: days.map(dayLabel), datasets }, options: opt }));
  }

  function cumulativeLine(canvas, rows, endCap) {
    if (!rows.length) return;
    const days = dayRange(rows, endCap);
    const counts = countBy(rows, r => r.day);
    let run = 0;
    const data = days.map(d => (run += counts.get(dayKey(d)) || 0));
    const color = cssVar('--bar');
    const opt = chartBase();
    opt.plugins.tooltip.callbacks = {
      title: items => { const d = days[items[0].dataIndex]; return `${DOW[d.getDay()]}, ${dayLabel(d)}`; },
      label: item => ` Luỹ kế: ${item.raw} đăng ký`,
    };
    charts.push(new Chart(canvas, {
      type: 'line',
      data: { labels: days.map(dayLabel), datasets: [{ data, borderColor: color, backgroundColor: color + '22', fill: true, borderWidth: 2, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, pointHoverBorderColor: cssVar('--surface'), pointHoverBorderWidth: 2 }] },
      options: opt,
    }));
  }

  function paceChart(canvas) {
    const datasets = state.events.map(ev => {
      const rows = state.byEvent.get(ev);
      const { start } = eventDates(rows);
      const anchor = start ? startOfDay(start) : startOfDay(rows[0].ts);
      const counts = countBy(rows, r => Math.round((startOfDay(r.ts) - anchor) / DAY));
      const xs = [...counts.keys()].sort((a, b) => a - b);
      let run = 0;
      const pts = xs.map(x => ({ x, y: (run += counts.get(x)) }));
      const today = Math.round((startOfDay(new Date()) - anchor) / DAY);
      if (pts.length && today > pts[pts.length - 1].x && today <= 0) pts.push({ x: today, y: run });
      const color = cssVar(state.eventColor.get(ev));
      return { label: eventTitle(ev), data: pts, borderColor: color, backgroundColor: color, borderWidth: 2, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 5 };
    });
    const opt = chartBase();
    opt.interaction = { mode: 'nearest', intersect: false };
    opt.scales.x = { ...opt.scales.x, type: 'linear', title: { display: true, text: 'Số ngày so với buổi đầu tiên (0 = ngày diễn ra)', color: cssVar('--muted'), font: { family: 'Quicksand', size: 11 } }, ticks: { ...opt.scales.x.ticks, precision: 0 } };
    opt.plugins.tooltip.callbacks = { title: items => `${items[0].raw.x <= 0 ? `Còn ${-items[0].raw.x} ngày` : `Sau ${items[0].raw.x} ngày`}`, label: item => ` ${item.dataset.label}: ${item.raw.y} đăng ký` };
    charts.push(new Chart(canvas, { type: 'line', data: { datasets }, options: opt }));
  }

  /* ---------------- insights ---------------- */
  function buildInsights(rows, scope) {
    const out = [];
    const n = rows.length;
    if (!n) return out;
    const tp = top(countBy(rows, r => r.position)), tt = top(countBy(rows, r => r.teamSize)), te = top(countBy(rows, r => r.mgmtExp)), tc = top(countBy(rows, r => r.cohort));
    if (tp) out.push({ html: `<b>Chân dung điển hình:</b> ${esc(tp[0])} (${pct(tp[1], n)}%)${tt ? `, đang quản lý <b>${esc(tt[0].toLowerCase())}</b>` : ''}${te ? `, kinh nghiệm quản lý <b>${esc(te[0].toLowerCase())}</b>` : ''}${tc ? `, sinh <b>${esc(tc[0])}</b> (${cohortSub(tc[0])})` : ''}.` });
    const ind = toItems(countBy(rows, r => r.industries)).filter(i => i.label !== UNKNOWN).slice(0, 3);
    if (ind.length) out.push({ html: `<b>Lĩnh vực nổi bật:</b> ${ind.map(i => `${esc(i.label)} (${i.value})`).join(', ')}.` });
    const withQ = rows.filter(r => !r.noConcern);
    const th = toItems(countBy(withQ, r => r.themes)).filter(i => i.label !== 'other').slice(0, 3);
    if (th.length) out.push({ html: `<b>Mối bận tâm #1:</b> ${esc(themeLabel(th[0].label))} — ${th[0].value}/${withQ.length} câu hỏi có nội dung${th[1] ? `; tiếp theo: ${th.slice(1).map(i => esc(themeLabel(i.label).toLowerCase())).join(', ')}` : ''}.` });
    const ts = top(countBy(rows, r => r.source)), tcamp = top(countBy(rows, r => r.campaign));
    if (ts) out.push({ html: `<b>Kênh mạnh nhất:</b> ${esc(ts[0])} mang về ${pct(ts[1], n)}% đăng ký${tcamp ? `; chiến dịch hiệu quả nhất: <b>${esc(tcamp[0])}</b> (${tcamp[1]})` : ''}.` });
    const hours = countBy(rows, r => r.ts.getHours()), dows = countBy(rows, r => DOW[r.ts.getDay()]);
    const th1 = top(hours), td1 = top(dows);
    if (th1) out.push({ html: `<b>Giờ vàng đăng ký:</b> ${th1[0]}h–${+th1[0] + 1}h (${th1[1]} lượt); ngày trong tuần đông nhất: <b>${td1[0]}</b>. Nên lên lịch đăng bài / nhắc nhở quanh khung này.` });
    if (scope === 'event') {
      const ts1 = top(countBy(rows, r => r.session.label));
      if (ts1) out.push({ html: `<b>Buổi được chọn nhiều nhất:</b> ${esc(ts1[0])} — ${ts1[1]} người (${pct(ts1[1], n)}%).` });
    }
    const nm = rows.filter(r => r.teamSize === NOT_MANAGING).length;
    if (nm) out.push({ warn: true, html: `<b>${nm} người (${pct(nm, n)}%) chưa trực tiếp quản lý ai</b> — nhóm “chuẩn bị lên quản lý”, cần ví dụ dễ áp dụng cho họ.` });
    const empty = rows.filter(r => r.noConcern).length;
    if (empty) out.push({ warn: true, html: `<b>${empty} người (${pct(empty, n)}%) chưa nêu khó khăn cụ thể</b> — có thể gửi câu hỏi khảo sát trước buổi để hiểu thêm.` });
    const nc = rows.filter(r => r.consent !== 'yes').length;
    if (nc) out.push({ warn: true, html: `<b>${nc} người chưa đồng ý consent</b> — loại khỏi danh sách dùng dữ liệu cho mục đích marketing.` });
    const dup = duplicates(rows);
    if (dup) out.push({ warn: true, html: `<b>${dup} lượt đăng ký trùng</b> (cùng email/SĐT trong một sự kiện) — số người thực tế là ${n - dup}.` });
    return out;
  }

  /* ---------------- views ---------------- */
  function filterRows(rows) {
    const f = state.filters;
    return rows.filter(r =>
      (!f.source || (r.source || UNKNOWN) === f.source) &&
      (!f.position || (r.position || UNKNOWN) === f.position) &&
      (!f.mgmtExp || (r.mgmtExp || UNKNOWN) === f.mgmtExp) &&
      (!f.session || (r.session.label || UNKNOWN) === f.session));
  }

  function renderFilters(base) {
    const opts = (fn, order) => toItems(countBy(base, fn), order).map(i => i.label);
    const sel = (key, label, values) => `<label>${label}<select data-filter="${key}"><option value="">Tất cả</option>${values.map(v => `<option value="${esc(v)}"${state.filters[key] === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
    let html = sel('source', 'Kênh', opts(r => r.source)) + sel('position', 'Vị trí', opts(r => r.position)) + sel('mgmtExp', 'Kinh nghiệm quản lý', opts(r => r.mgmtExp, CFG.order.mgmtExp));
    if (state.route.view === 'event') html += sel('session', 'Buổi', opts(r => r.session.label));
    const active = Object.values(state.filters).some(Boolean);
    if (active) html += `<button class="reset" data-reset-filters type="button">✕ Bỏ lọc</button><span class="active-note">Đang xem ${filterRows(base).length}/${base.length} đăng ký</span>`;
    $('#filters').innerHTML = html;
  }

  function renderTabs() {
    const r = state.route;
    let html = `<a href="#/" class="${r.view === 'overview' ? 'active' : ''}">Tổng quan chuỗi<span class="count">${state.all.length}</span></a>`;
    for (const ev of state.events) {
      html += `<a href="#/event/${encodeURIComponent(ev)}" class="${r.view === 'event' && r.event === ev ? 'active' : ''}">${esc(eventTitle(ev))}<span class="count">${state.byEvent.get(ev).length}</span></a>`;
    }
    $('#tabs').innerHTML = html;
  }

  function render(keepScroll) {
    const y = window.scrollY;
    charts.forEach(c => c.destroy()); charts = [];
    if (state.route.view === 'event' && !state.byEvent.has(state.route.event)) state.route = { view: 'overview' };
    renderTabs();
    const isEvent = state.route.view === 'event';
    const base = isEvent ? state.byEvent.get(state.route.event) : state.all;
    renderFilters(base);
    const rows = filterRows(base);
    $('#subtitle').textContent = isEvent ? eventTitle(state.route.event) : `Tổng quan chuỗi · ${state.events.length} sự kiện`;
    if (!state.all.length) { $('#view').innerHTML = '<div class="state"><h2>Chưa có đăng ký nào</h2><p>Sheet đang trống — dashboard sẽ tự cập nhật khi có dữ liệu.</p></div>'; return; }

    let html = isEvent ? eventHeader(rows, base) : overviewHeader(rows);
    html += sectionMomentum(rows, isEvent);
    html += sectionSource(rows);
    html += sectionWho(rows);
    html += sectionWork(rows);
    html += sectionConcerns(rows);
    html += sectionOps(rows, isEvent);
    if (state.error) html = `<div class="err-box">Không cập nhật được lần gần nhất (${esc(state.error.message)}). Đang hiển thị dữ liệu cũ.</div>` + html;
    $('#view').innerHTML = html;
    mountCharts(rows, isEvent);
    if (keepScroll) window.scrollTo(0, y);
  }

  function overviewHeader(rows) {
    const n = rows.length;
    const people = new Set(rows.map(r => r.personKey));
    const perPerson = new Map();
    for (const r of state.all) { if (!perPerson.has(r.personKey)) perPerson.set(r.personKey, new Set()); perPerson.get(r.personKey).add(r.event); }
    const repeat = [...perPerson.values()].filter(s => s.size >= 2).length;
    const l = last24(rows);
    const consent = rows.filter(r => r.consent === 'yes').length;
    let html = `<div class="kpis">
      ${kpi('Tổng lượt đăng ký', fmt(n), `${state.events.length} sự kiện trong chuỗi`, true)}
      ${kpi('Người duy nhất', fmt(people.size), 'gộp trùng theo email/SĐT')}
      ${kpi('Tham gia ≥ 2 sự kiện', fmt(repeat), repeat ? `${pct(repeat, people.size)}% học viên quay lại` : 'chưa có học viên quay lại')}
      ${kpi('24 giờ qua', `+${l.cur}`, `24h trước đó: +${l.prev}`)}
      ${kpi('Đang quản lý đội nhóm', `${pct(rows.filter(isManaging).length, n)}<small>%</small>`, 'có ít nhất 1 người phụ trách')}
      ${kpi('Đồng ý consent', `${pct(consent, n)}<small>%</small>`, `${consent}/${n} người`)}
    </div>`;
    html += aiSummaryBox('__overview__') + insightsBox(rows, 'overview');
    // event comparison table
    const trs = state.events.map(ev => {
      const er = filterRows(state.byEvent.get(ev));
      const { start } = eventDates(state.byEvent.get(ev));
      const left = start ? Math.ceil((startOfDay(start) - startOfDay(new Date())) / DAY) : null;
      const span = er.length ? Math.max(1, Math.round((startOfDay(new Date(Math.min(Date.now(), start ? +start : Date.now()))) - startOfDay(er[0].ts)) / DAY) + 1) : 1;
      const withQ = er.filter(r => !r.noConcern);
      const tTheme = top(countBy(withQ, r => r.themes.filter(t => t !== 'other')));
      const tInd = top(countBy(er, r => r.industries)), tSrc = top(countBy(er, r => r.source));
      const lv = last24(er);
      return `<tr class="link" data-goto="${esc(ev)}">
        <td><span class="ev">${esc(eventTitle(ev))}</span></td>
        <td>${start ? `${DOW[start.getDay()]} ${dayLabel(start)}/${start.getFullYear()}` : '—'}</td>
        <td class="n">${left == null ? '—' : left > 0 ? `${left} ngày` : left === 0 ? '<span class="pill ok">Hôm nay</span>' : '<span class="pill na">Đã diễn ra</span>'}</td>
        <td class="n"><b>${er.length}</b></td>
        <td class="n">${lv.cur ? `<span class="up">+${lv.cur}</span>` : '0'}</td>
        <td class="n">${(er.length / span).toFixed(1)}</td>
        <td class="n">${pct(er.filter(isManaging).length, er.length)}%</td>
        <td class="n">${pct(er.filter(r => r.consent === 'yes').length, er.length)}%</td>
        <td>${tInd ? esc(tInd[0]) : '—'}</td>
        <td>${tTheme ? esc(themeLabel(tTheme[0])) : '—'}</td>
        <td>${tSrc ? esc(tSrc[0]) : '—'}</td>
      </tr>`;
    }).join('');
    html += section('★', 'So sánh các sự kiện', 'Bấm vào một dòng để mở dashboard riêng của sự kiện đó',
      `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>Sự kiện</th><th>Buổi đầu tiên</th><th class="n">Còn lại</th><th class="n">Đăng ký</th><th class="n">24h</th><th class="n">TB/ngày</th>
        <th class="n">% quản lý</th><th class="n">Consent</th><th>Lĩnh vực #1</th><th>Bận tâm #1</th><th>Kênh #1</th>
      </tr></thead><tbody>${trs}</tbody></table></div></div>`);
    return html;
  }

  function eventHeader(rows, base) {
    const n = rows.length;
    const { start, end } = eventDates(base);
    const left = start ? Math.ceil((startOfDay(start) - startOfDay(new Date())) / DAY) : null;
    const l = last24(rows);
    const span = n ? Math.max(1, Math.round((startOfDay(new Date(Math.min(Date.now(), start ? +start : Date.now()))) - startOfDay(rows[0].ts)) / DAY) + 1) : 1;
    const consent = rows.filter(r => r.consent === 'yes').length;
    const dup = duplicates(rows);
    const sameDay = start && end && dayKey(start) === dayKey(end);
    let html = `<div class="kpis">
      ${kpi('Tổng đăng ký', fmt(n), dup ? `${n - dup} người (đã gộp ${dup} trùng)` : 'không có đăng ký trùng', true)}
      ${kpi('24 giờ qua', `+${l.cur}`, `24h trước đó: +${l.prev}`)}
      ${kpi('Đếm ngược', left == null ? '—' : left > 0 ? `${left}<small> ngày</small>` : left === 0 ? 'Hôm nay' : 'Đã diễn ra', start ? `${DOW[start.getDay()]} ${dayLabel(start)}${sameDay || !end ? '' : ` → ${DOW[end.getDay()]} ${dayLabel(end)}`}` : '')}
      ${kpi('Trung bình / ngày', (n / span).toFixed(1), `trong ${span} ngày mở đăng ký`)}
      ${kpi('Đang quản lý đội nhóm', `${pct(rows.filter(isManaging).length, n)}<small>%</small>`, `${pct(rows.filter(isSenior).length, n)}% có > 3 năm kinh nghiệm`)}
      ${kpi('Đồng ý consent', `${pct(consent, n)}<small>%</small>`, `${consent}/${n} người`)}
    </div>`;
    return html + aiSummaryBox(state.route.event) + insightsBox(rows, 'event');
  }

  const MODEL_NAMES = { 'anthropic/claude-haiku-5.5': 'Claude Haiku 5.5', 'anthropic/claude-sonnet-5.5': 'Claude Sonnet 5.5', 'google/gemma-4-26b-a4b-it': 'Gemma 4' };

  function aiSummaryBox(scopeKey) {
    const s = state.summaries && state.summaries[scopeKey];
    if (!s || !s.headline) return '';
    const at = s.generatedAt ? new Date(s.generatedAt) : null;
    const when = at && !isNaN(at) ? `${pad(at.getHours())}:${pad(at.getMinutes())} ${dayLabel(at)}` : '';
    const stale = at && Date.now() - at > 36 * 3600 * 1000;
    const filtered = Object.values(state.filters).some(Boolean);
    const li = arr => (arr || []).map(x => `<li>${esc(x)}</li>`).join('');
    return `<div class="ai-sum">
      <div class="ai-head"><span class="ai-badge">🤖 Tóm tắt AI hằng ngày</span>
        <span class="ai-meta">${esc(MODEL_NAMES[s.model] || s.model || '')}${when ? ` · viết lúc ${when}` : ''}${stale ? ' · <b>bản cũ — kiểm tra lịch chạy</b>' : ''}${filtered ? ' · tóm tắt toàn bộ dữ liệu, không theo bộ lọc' : ''}</span></div>
      <p class="ai-headline">${esc(s.headline)}</p>
      <div class="ai-grid">
        <div>${s.who ? `<h4>Họ là ai</h4><p>${esc(s.who)}</p>` : ''}${s.trend ? `<h4>Nhịp đăng ký</h4><p>${esc(s.trend)}</p>` : ''}</div>
        <div>${(s.concerns || []).length ? `<h4>Họ đang lo điều gì</h4><ol>${s.concerns.map(c => `<li><b>${esc(c.title)}</b>${c.detail ? ` — ${esc(c.detail)}` : ''}${c.quote ? `<q>${esc(c.quote)}</q>` : ''}</li>`).join('')}</ol>` : ''}</div>
        <div>${(s.actions || []).length ? `<h4>Nên làm hôm nay</h4><ul class="ai-act">${li(s.actions)}</ul>` : ''}${(s.watch || []).length ? `<h4>Cần để ý</h4><ul class="ai-watch">${li(s.watch)}</ul>` : ''}</div>
      </div>
    </div>`;
  }

  function insightsBox(rows, scope) {
    const ins = buildInsights(rows, scope);
    if (!ins.length) return '';
    const hasAi = !!(state.summaries && state.summaries[scope === 'event' ? state.route.event : '__overview__']);
    return `<div class="insights"><h3>${hasAi ? '📊 Số liệu nhanh (cập nhật liên tục)' : '💡 Đọc nhanh: họ là ai, đến từ đâu, đang lo gì?'}</h3><ul>${ins.map(i => `<li class="${i.warn ? 'warn' : ''}">${i.html}</li>`).join('')}</ul></div>`;
  }

  function sectionMomentum(rows, isEvent) {
    const groups = isEvent ? toItems(countBy(rows, r => r.source || UNKNOWN)).map(i => i.label).sort((a, b) => [...state.sourceColor.keys()].indexOf(a) - [...state.sourceColor.keys()].indexOf(b)) : state.events;
    const leg = isEvent ? groups.map(g => ({ label: g, color: state.sourceColor.get(g) || '--c-other' })) : groups.map(ev => ({ label: eventTitle(ev), color: state.eventColor.get(ev) }));
    const sessKey = r => (r.session.label ? (isEvent ? r.session.label : `${eventTitle(r.event)} · ${r.session.label}`) : UNKNOWN);
    const sessionItems = toItems(countBy(rows, sessKey)).map(i => {
      const s = rows.find(r => sessKey(r) === i.label);
      const d = s && s.session.date;
      return {
        ...i,
        date: d,
        label: d ? `${DOW[d.getDay()]} ${dayLabel(d)}/${d.getFullYear()} · ${s.session.time}` : i.label,
        sub: isEvent || !s ? '' : eventTitle(s.event),
      };
    }).sort((a, b) => (a.date ? +a.date : Infinity) - (b.date ? +b.date : Infinity));
    let body = `<div class="grid g-7-5">
      ${card('Số lượng đăng ký theo ngày', isEvent ? 'Chia theo kênh (utm_source) · rê chuột để xem luỹ kế' : 'Chia theo sự kiện', legend(leg) + '<div class="chart-box"><canvas id="chDaily"></canvas></div>')}
      ${isEvent
        ? card('Đăng ký luỹ kế', 'Tổng số người đã đăng ký theo thời gian', '<div class="chart-box" style="margin-top:28px"><canvas id="chCum"></canvas></div>')
        : card('Tốc độ đăng ký giữa các sự kiện', 'Luỹ kế theo số ngày trước buổi đầu tiên — so sánh sự kiện nào “nóng” hơn', legend(leg) + '<div class="chart-box"><canvas id="chPace"></canvas></div>')}
    </div>
    <div class="grid g-7-5" style="margin-top:16px">
      ${card('Heatmap giờ đăng ký', 'Ngày trong tuần × giờ trong ngày — biết lúc nào khán giả online để đăng bài, gửi nhắc', heatmap(rows))}
      ${card('Khung giờ / buổi được chọn', 'Buổi học viên chọn tham gia · xếp theo ngày diễn ra', barList(sessionItems, { total: rows.length, limit: 20, subFn: i => i.sub }))}
    </div>`;
    return section(1, 'Nhịp đăng ký', 'Đăng ký đến lúc nào, từ ngày nào, chọn buổi nào', body);
  }

  function sectionSource(rows) {
    const n = rows.length;
    const srcItems = toItems(countBy(rows, r => r.source));
    const campItems = toItems(countBy(rows, r => r.campaign)).map(i => {
      const src = top(countBy(rows.filter(r => (r.campaign || UNKNOWN) === i.label), r => r.source));
      return { ...i, src: src ? src[0] : '' };
    });
    const quality = srcItems.map(i => {
      const g = rows.filter(r => (r.source || UNKNOWN) === i.label);
      return `<tr><td><span class="legend" style="margin:0"><span><i style="background:var(${state.sourceColor.get(i.label) || '--c-other'})"></i><b>${esc(i.label)}</b></span></span></td>
        <td class="n">${g.length}</td><td class="n">${pct(g.length, n)}%</td>
        <td class="n">${pct(g.filter(isManaging).length, g.length)}%</td>
        <td class="n">${pct(g.filter(isSenior).length, g.length)}%</td>
        <td class="n">${pct(g.filter(r => !r.noConcern).length, g.length)}%</td>
        <td class="n">${pct(g.filter(r => r.consent === 'yes').length, g.length)}%</td></tr>`;
    }).join('');
    const C = CFG.columns;
    const cityCard = C.city != null
      ? card('Tỉnh / Thành phố', '', barList(toItems(countBy(rows, r => r.city)), { total: n }))
      : card('Vị trí địa lý', 'Form hiện chưa hỏi Tỉnh/Thành phố', `<div class="note">Muốn biết học viên ở <b>tỉnh/thành nào</b> (để chọn giờ, chọn online/offline, chạy quảng cáo theo vùng): thêm trường <b>“Tỉnh/Thành phố đang sống & làm việc”</b> (dạng chọn) vào form LadiPage, rồi khai báo cột đó ở <b>config.js → columns.city</b>. Dashboard sẽ tự hiện biểu đồ.</div>`);
    const body = `<div class="grid g3">
      ${card('Kênh (utm_source)', 'Học viên biết đến sự kiện từ đâu', barList(srcItems, { total: n, colorFn: i => state.sourceColor.get(i.label) || '--c-other' }))}
      ${card('Chiến dịch (utm_campaign)', 'Bài đăng / chiến dịch cụ thể mang về đăng ký', barList(campItems, { total: n, subFn: i => i.src ? `qua ${i.src}` : '' }))}
      ${cityCard}
      <div class="card span2" style="grid-column:1/-1"><h3>Chất lượng theo kênh</h3><p class="hint">Kênh nào mang về đúng chân dung mục tiêu (người đang quản lý, có kinh nghiệm, có vấn đề cụ thể)?</p>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kênh</th><th class="n">Đăng ký</th><th class="n">Tỉ trọng</th><th class="n">% đang quản lý</th><th class="n">% KN quản lý > 3 năm</th><th class="n">% có câu hỏi cụ thể</th><th class="n">% consent</th></tr></thead><tbody>${quality}</tbody></table></div></div>
    </div>`;
    return section(2, 'Họ đến từ đâu', 'Kênh, chiến dịch và chất lượng người đăng ký theo từng kênh', body);
  }

  function sectionWho(rows) {
    const n = rows.length;
    const order = CFG.order;
    const expItems = toItems(countBy(rows, r => r.mgmtExp), order.mgmtExp);
    const teamItems = toItems(countBy(rows, r => r.teamSize), order.teamSize);
    const body = `<div class="grid g2">
      ${card('Vị trí / cấp bậc', 'Vai trò hiện tại trong tổ chức', barList(toItems(countBy(rows, r => r.position)), { total: n }))}
      ${card('Độ tuổi (theo năm sinh)', 'Nhóm năm sinh của học viên', barList(toItems(countBy(rows, r => r.cohort), COHORTS), { total: n, subFn: i => cohortSub(i.label) }))}
      ${card('Số năm kinh nghiệm quản lý', 'Đã làm quản lý bao lâu', barList(expItems, { total: n }))}
      ${card('Quy mô đội đang quản lý', 'Số người đang trực tiếp phụ trách', barList(teamItems, { total: n }))}
      ${card('Ma trận: Kinh nghiệm quản lý × Quy mô đội', 'Ô đậm = nhóm đông nhất. Góc trên-trái là “quản lý mới, đội nhỏ”; góc dưới-phải là “quản lý lâu năm, đội lớn”.',
        matrix(expItems.map(i => ({ label: i.label })), teamItems.map(i => ({ label: i.label })), (e, t) => rows.filter(r => (r.mgmtExp || UNKNOWN) === e && (r.teamSize || UNKNOWN) === t).length), 'span2')}
    </div>`;
    return section(3, 'Họ là ai', 'Cấp bậc, độ tuổi, kinh nghiệm và quy mô đội nhóm', body);
  }

  function sectionWork(rows) {
    const n = rows.length;
    const posXind = toItems(countBy(rows, r => r.industries)).filter(i => i.label !== UNKNOWN).slice(0, 8);
    const positions = toItems(countBy(rows, r => r.position));
    const nInd = rows.filter(r => r.industryByAi).length;
    const indHint = nInd
      ? `🤖 AI đã xếp ${nInd}/${rows.length} người vào nhóm ngành chuẩn${nInd < rows.length ? ' · số còn lại đang chờ AI, tạm gộp theo cách viết' : ''} · rê chuột lên câu hỏi để xem học viên tự ghi gì`
      : 'Đã gộp các cách viết khác nhau (vd. “Giáo dục ” và “giáo dục”). Một người có thể thuộc nhiều lĩnh vực.';
    const body = `<div class="grid g-7-5">
      ${card('Lĩnh vực đang hoạt động', indHint, barList(toItems(countBy(rows, r => r.industries)), { total: n, limit: 14 }))}
      ${card('Lĩnh vực × Vị trí', 'Top lĩnh vực theo cấp bậc', matrix(posXind.map(i => ({ label: i.label })), positions.map(i => ({ label: i.label })), (ind, pos) => rows.filter(r => r.industries.includes(ind) && (r.position || UNKNOWN) === pos).length))}
    </div>`;
    return section(4, 'Họ đang làm gì', 'Ngành nghề và cấp bậc theo từng ngành', body);
  }

  function sectionConcerns(rows) {
    const withQ = rows.filter(r => !r.noConcern);
    const nAi = withQ.filter(r => r.byAi).length;
    const how = nAi ? `🤖 AI (Claude Haiku) đã phân loại ${nAi}/${withQ.length} câu${nAi < withQ.length ? ' · số còn lại đang chờ AI (tối đa 15 phút), tạm phân loại theo từ khoá' : ''}` : 'Phân loại tự động theo từ khoá';
    const themeItems = toItems(countBy(withQ, r => r.themes)).map(i => ({ ...i, key: i.label, label: themeLabel(i.label) }));
    const dims = {
      mgmtExp: { label: 'Kinh nghiệm quản lý', fn: r => r.mgmtExp, order: CFG.order.mgmtExp },
      position: { label: 'Vị trí', fn: r => r.position },
      teamSize: { label: 'Quy mô đội', fn: r => r.teamSize, order: CFG.order.teamSize },
      cohort: { label: 'Độ tuổi', fn: r => r.cohort, order: COHORTS },
      source: { label: 'Kênh', fn: r => r.source },
    };
    const dim = dims[state.matrixDim];
    const colItems = toItems(countBy(withQ, dim.fn), dim.order).map(i => ({ label: i.label }));
    const mx = matrix(themeItems.map(i => ({ label: i.label, key: i.key })), colItems,
      (th, col) => withQ.filter(r => r.themes.includes(th) && (dim.fn(r) || UNKNOWN) === col).length, { rowClick: 'theme-id' });
    // Màu theo nhóm vấn đề — cùng màu với biểu đồ "Nhóm vấn đề" để đọc chéo
    const words = keywords(rows).map(w => {
      const counts = {};
      for (const r of withQ) {
        const hit = r.aiKeywords.length ? r.aiKeywords.includes(w.word) : r.question.toLowerCase().includes(w.word);
        if (hit) r.themes.forEach(t => (counts[t] = (counts[t] || 0) + 1));
      }
      const theme = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || (a === 'other') - (b === 'other'))[0] || 'other';
      return { ...w, theme };
    });
    const vals = words.map(w => w.value);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const sizeOf = v => (hi > lo ? 14 + 18 * Math.sqrt((v - lo) / (hi - lo)) : 17);
    // từ lớn ở giữa, nhỏ dần ra hai bên
    const arranged = [];
    words.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)));
    const cloud = words.length ? `<div class="cloud">${arranged.map(w => `<button type="button" data-word="${esc(w.word)}"
        class="kw${state.q.word === w.word ? ' selected' : ''}" style="--kc:var(${themeColor(w.theme)});font-size:${sizeOf(w.value).toFixed(1)}px"
        data-tip="“${esc(w.word)}” · ${w.value} câu hỏi · nhóm: ${esc(themeLabel(w.theme))} · bấm để lọc"><i></i>${esc(w.word)}</button>`).join('')}</div>`
      : '<div class="empty">Chưa đủ câu hỏi để trích từ khoá</div>';

    const body = `<div class="grid g2">
      ${card('Nhóm vấn đề họ đang gặp', `${how} · ${withQ.length}/${rows.length} người có câu hỏi cụ thể · một câu có thể thuộc nhiều nhóm · bấm để xem câu hỏi`, barList(themeItems, { total: withQ.length, click: 'theme-id', selected: state.q.theme, limit: 20, colorFn: i => themeColor(i.key) }))}
      ${card('Từ khoá nổi bật', `${nAi ? 'Từ khoá do AI rút ra từ từng câu hỏi' : 'Cụm từ xuất hiện nhiều nhất trong câu hỏi'} · màu = nhóm vấn đề (như biểu đồ bên cạnh) · cỡ chữ = số câu hỏi nhắc tới · bấm để lọc`, cloud)}
      <div class="card span2"><div class="card-head"><div><h3>Vấn đề × ${esc(dim.label)}</h3><p class="hint">Mỗi nhóm người lo lắng điều gì khác nhau? Bấm tên vấn đề để xem câu hỏi.</p></div>
        <label class="hint" style="margin:0">Xem theo&nbsp;<select data-matrix>${Object.entries(dims).map(([k, d]) => `<option value="${k}"${k === state.matrixDim ? ' selected' : ''}>${d.label}</option>`).join('')}</select></label></div>${mx}</div>
      <div class="card span2" id="questions">${questionsBlock(rows)}</div>
    </div>`;
    return section(5, 'Họ bận tâm điều gì', 'Phân tích câu hỏi / khó khăn học viên gửi về', body);
  }

  function questionsBlock(rows) {
    const q = state.q;
    let list = rows.slice().reverse();
    if (q.hideEmpty) list = list.filter(r => !r.noConcern);
    let hl = [];
    if (q.theme) { list = list.filter(r => r.themes.includes(q.theme)); hl = q.theme === 'other' ? [] : (CFG.themes.find(t => t.id === q.theme) || { keywords: [] }).keywords; }
    if (q.word) { list = list.filter(r => r.aiKeywords.includes(q.word) || r.question.toLowerCase().includes(q.word)); hl = [q.word]; }
    const mark = text => {
      let h = esc(text);
      for (const k of hl) { const re = new RegExp(`(${esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); h = h.replace(re, '<mark>$1</mark>'); }
      return h;
    };
    const active = q.theme ? themeLabel(q.theme) : q.word ? `“${q.word}”` : '';
    const items = list.map(r => `<div class="q"><p>${mark(r.question || '(bỏ trống)')}</p><div class="meta">
      ${r.themes.filter(t => t !== 'other').map(t => `<span class="t">${esc(themeLabel(t))}</span>`).join('')}
      ${r.aiKeywords.map(k => `<span class="k${q.word === k ? ' on' : ''}" data-word="${esc(k)}" title="Từ khoá do AI rút ra · bấm để lọc">${esc(k)}</span>`).join('')}
      ${r.position ? `<span>${esc(r.position)}</span>` : ''}${r.industries.length ? `<span title="${esc(r.industryRaw ? `Học viên ghi: ${r.industryRaw}` : '')}">${esc(r.industries.join(', '))}</span>` : ''}
      ${r.mgmtExp ? `<span>KN QL: ${esc(r.mgmtExp)}</span>` : ''}${r.teamSize ? `<span>Đội: ${esc(r.teamSize)}</span>` : ''}
      ${r.birthYear ? `<span>${NOW_YEAR - r.birthYear} tuổi</span>` : ''}<span>${dayLabel(r.ts)} · ${esc(r.source || '?')}</span>
      ${state.route.view === 'overview' ? `<span>${esc(eventTitle(r.event))}</span>` : ''}</div></div>`).join('');
    return `<h3>Câu hỏi / khó khăn học viên gửi về</h3><p class="hint">Ẩn danh — chỉ hiện hồ sơ nghề nghiệp, không hiện tên / email / SĐT. Mới nhất ở trên.</p>
      <div class="q-toolbar"><div>${active ? `<span class="chip-on">Lọc: ${esc(active)}</span> <button type="button" data-clear-q>✕ Bỏ lọc</button> · ` : ''}${list.length} câu hỏi</div>
      <label><input type="checkbox" id="hideEmpty" ${q.hideEmpty ? 'checked' : ''}> Ẩn câu “chưa có / không”</label></div>
      ${list.length ? `<div class="q-list">${items}</div>` : '<div class="empty">Không có câu hỏi phù hợp bộ lọc</div>'}`;
  }

  function sectionOps(rows, isEvent) {
    const n = rows.length;
    const yes = rows.filter(r => r.consent === 'yes').length, no = rows.filter(r => r.consent === 'no').length, blank = n - yes - no;
    const consentBody = `<div class="k-value" style="font-size:30px;font-weight:700">${pct(yes, n)}%<small style="font-size:14px;color:var(--muted);font-weight:600"> đồng ý</small></div>
      <div class="stack" role="img" aria-label="Đồng ý ${yes}, không đồng ý ${no}, trống ${blank}">
        ${yes ? `<div style="flex:${yes};background:var(--good)" data-tip="Đồng ý: ${yes}"></div>` : ''}${no ? `<div style="flex:${no};background:var(--bad)" data-tip="Không đồng ý: ${no}"></div>` : ''}${blank ? `<div style="flex:${blank};background:var(--c-other)" data-tip="Chưa có thông tin: ${blank}"></div>` : ''}
      </div>
      <ul class="dq">
        <li><span><span class="pill ok">✓ Đồng ý</span></span><b>${yes}</b></li>
        <li><span><span class="pill no">✕ Không đồng ý</span></span><b>${no}</b></li>
        <li><span><span class="pill na">– Chưa có thông tin</span></span><b>${blank}</b></li>
      </ul>
      <div class="note">Chỉ dùng thông tin của nhóm <b>đã đồng ý</b> cho email marketing, remarketing, case study. Nhóm còn lại vẫn nhận thông tin vận hành buổi học.</div>`;
    const invalidYear = rows.filter(r => !r.birthYear).length;
    const noInd = rows.filter(r => !r.industries.length).length;
    const noUtm = rows.filter(r => !r.source).length;
    const noCamp = rows.filter(r => !r.campaign).length;
    const dq = `<ul class="dq">
      <li><span>Đăng ký trùng (cùng email/SĐT trong 1 sự kiện)</span><b>${duplicates(rows)}</b></li>
      <li><span>Năm sinh trống / không hợp lệ</span><b>${invalidYear}</b></li>
      <li><span>Thiếu lĩnh vực</span><b>${noInd}</b></li>
      <li><span>Thiếu utm_source (không rõ kênh)</span><b>${noUtm}</b></li>
      <li><span>Thiếu utm_campaign</span><b>${noCamp}</b></li>
      <li><span>Câu hỏi trống / “chưa có”</span><b>${rows.filter(r => r.noConcern).length}</b></li>
    </ul><div class="note">Mẹo: dùng link có <b>utm_campaign</b> riêng cho từng bài đăng / nhóm Zalo / email để biết chính xác bài nào hiệu quả.</div>`;
    return section(6, 'Consent & chất lượng dữ liệu', isEvent ? '' : 'Toàn chuỗi', `<div class="grid g2">${card('Tình trạng consent form', '', consentBody)}${card('Chất lượng dữ liệu', 'Các điểm cần làm sạch trước khi gửi email / chia nhóm', dq)}</div>`);
  }

  function mountCharts(rows, isEvent) {
    if (!rows.length || !window.Chart) return;
    const daily = $('#chDaily');
    if (isEvent) {
      const { start } = eventDates(state.byEvent.get(state.route.event));
      const groups = [...state.sourceColor.keys()].filter(s => rows.some(r => (r.source || UNKNOWN) === s));
      dailyStacked(daily, rows, r => r.source || UNKNOWN, groups, g => state.sourceColor.get(g) || '--c-other', start);
      cumulativeLine($('#chCum'), rows, start);
    } else {
      dailyStacked(daily, rows, r => r.event, state.events, ev => state.eventColor.get(ev), null);
      paceChart($('#chPace'));
    }
  }

  /* ---------------- interactions ---------------- */
  const view = $('#view');
  function rerenderKeep(scrollToQuestions) {
    render(true);
    if (scrollToQuestions) $('#questions').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  view.addEventListener('click', e => {
    const t = e.target.closest('[data-theme-id],[data-word],[data-goto],[data-clear-q]');
    if (!t) return;
    if (t.dataset.goto) { location.hash = `/event/${encodeURIComponent(t.dataset.goto)}`; return; }
    if (t.hasAttribute('data-clear-q')) { state.q.theme = null; state.q.word = null; rerenderKeep(false); return; }
    if (t.dataset.themeId) { state.q.theme = state.q.theme === t.dataset.themeId ? null : t.dataset.themeId; state.q.word = null; }
    if (t.dataset.word) { state.q.word = state.q.word === t.dataset.word ? null : t.dataset.word; state.q.theme = null; }
    rerenderKeep(true);
  });
  view.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); } });
  view.addEventListener('change', e => {
    if (e.target.matches('[data-matrix]')) { state.matrixDim = e.target.value; rerenderKeep(false); }
    if (e.target.id === 'hideEmpty') { state.q.hideEmpty = e.target.checked; rerenderKeep(false); }
  });
  $('#filters').addEventListener('change', e => {
    if (e.target.dataset.filter) { state.filters[e.target.dataset.filter] = e.target.value; render(true); }
  });
  $('#filters').addEventListener('click', e => {
    if (e.target.closest('[data-reset-filters]')) { state.filters = freshFilters(); render(true); }
  });
  window.addEventListener('hashchange', () => {
    state.route = readRoute(); state.filters = freshFilters(); state.q = { theme: null, word: null, hideEmpty: true };
    render(false); window.scrollTo(0, 0);
  });
  $('#refreshBtn').addEventListener('click', () => load());

  // tooltip
  const tip = $('#tooltip');
  document.addEventListener('mousemove', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('scroll', () => (tip.hidden = true), { passive: true });

  // live refresh
  setInterval(() => { if (!document.hidden) load(); }, Math.max(15, CFG.refreshSeconds) * 1000);
  setInterval(setLive, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.lastFetch && Date.now() - state.lastFetch > 15000) load(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.all.length && render(true));

  load();
})();
