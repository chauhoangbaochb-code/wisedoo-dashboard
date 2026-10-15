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
  const isNarrow = () => window.matchMedia('(max-width: 640px)').matches;
  const TOUCH = window.matchMedia('(hover: none)').matches;
  const hoverWord = TOUCH ? 'chạm' : 'rê chuột';
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
    if (!s) return { label: '', date: null, end: null, time: '' };
    const d = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    const t = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.exec(s);
    let date = null, end = null;
    if (d) {
      const [hh, mm] = t ? t[1].split(':').map(Number) : [0, 0];
      date = new Date(+d[3], d[2] - 1, +d[1], hh, mm);
      if (t) { const [eh, em] = t[2].split(':').map(Number); end = new Date(+d[3], d[2] - 1, +d[1], eh, em); }
      else end = new Date(+d[3], d[2] - 1, +d[1] + 1);
    }
    return { label: s, date, end, time: t ? `${t[1]}–${t[2]}` : '' };
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
    const validIds = CFG.themes.map(t => t.id).concat('other', 'none');
    const aiThemes = g('aiThemes').split(',').map(x => x.trim()).filter(x => validIds.includes(x));
    // AI gắn "none" = câu không nêu khó khăn cụ thể (bắt được cả kiểu "chua co gi", "có rất nhiều")
    const noConcern = isNoConcern(question) || aiThemes.includes('none');
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
    state.targets = data.targets || {};
    const adsName = keyOf(adsCfg().sheetName);
    const adsSheet = (data.sheets || []).find(sh => keyOf(sh.name) === adsName);
    state.ads = parseAds((data.ads && data.ads.rows) || (adsSheet && adsSheet.rows) || null);
    return (data.sheets || []).filter(sh => sh !== adsSheet).map(sh => {
      const src = CFG.sources.find(x => String(x.gid) === String(sh.gid) || x.label === sh.name) || { label: sh.name };
      const columns = { ...(src.columns || CFG.columns) };
      if (sh.aiCols) { columns.aiThemes = sh.aiCols.themes; columns.aiKeywords = sh.aiCols.keywords; columns.aiIndustry = sh.aiCols.industry; }
      return { src: { ...src, columns }, rows: sh.rows || [] };
    });
  }

  /* ---------------- quảng cáo (tab "Facebook Ads") ---------------- */
  const adsCfg = () => ({ sheetName: 'Facebook Ads', eventOf: {}, utmCampaigns: null, fxRate: 0, ...(CFG.ads || {}) });
  const META_SOURCES = ['facebook', 'fb', 'instagram', 'ig', 'meta'];
  // Nhận cả bản xuất tiếng Việt lẫn tiếng Anh của Trình quản lý quảng cáo
  const ADS_HEADERS = {
    campaign: /^(tên chiến dịch|campaign name)$/,
    adset: /^(tên nhóm quảng cáo|ad set name)$/,
    ad: /^(tên quảng cáo|ad name)$/,
    impressions: /^(lượt hiển thị|impressions)$/,
    resultType: /^(loại kết quả|result type|result indicator)$/,
    results: /^(kết quả|results)$/,
    spend: /^(số tiền đã chi tiêu|amount spent)/,
    clicks: /^(lượt click vào liên kết|link clicks)$/,
    reportStart: /^(lượt bắt đầu báo cáo|bắt đầu báo cáo|reporting starts)$/,
    reportEnd: /^(lượt kết thúc báo cáo|kết thúc báo cáo|reporting ends)$/,
  };
  const normKey = s => clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
  const num = v => (typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')) || 0);
  const isLeadType = t => /lead|khách hàng tiềm năng|đăng ký|registration|form/i.test(t || '');
  const isoDate = v => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(clean(v)); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };

  function parseAds(table) {
    if (!Array.isArray(table) || table.length < 2) return null;
    const head = table[0].map(h => clean(h).toLowerCase());
    const idx = {};
    for (const [k, re] of Object.entries(ADS_HEADERS)) idx[k] = head.findIndex(h => re.test(h));
    if (idx.campaign < 0 || idx.spend < 0) return null;
    const currency = (/\(([a-z]{3})\)/i.exec(table[0][idx.spend]) || [])[1] || '';
    const get = (r, k) => (idx[k] < 0 ? '' : r[idx[k]]);
    const rows = table.slice(1).filter(r => clean(get(r, 'campaign'))).map(r => ({
      campaign: clean(get(r, 'campaign')), adset: clean(get(r, 'adset')), ad: clean(get(r, 'ad')),
      impressions: num(get(r, 'impressions')), clicks: num(get(r, 'clicks')), spend: num(get(r, 'spend')),
      resultType: clean(get(r, 'resultType')), results: num(get(r, 'results')),
      reportStart: isoDate(get(r, 'reportStart')), reportEnd: isoDate(get(r, 'reportEnd')),
    }));
    return { currency: currency.toUpperCase(), rows };
  }

  function adEvent(a) {
    const map = adsCfg().eventOf;
    if (map[a.campaign]) return map[a.campaign];
    const c = normKey(a.campaign);
    return state.events.find(ev => normKey(ev).length >= 3 && c.includes(normKey(ev))) || '';
  }

  // #/[event/<tên>/]<tab>  —  tab trống = Tổng quan
  const SUBS = [
    { id: 'overview', label: 'Tổng quan', icon: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>' },
    { id: 'marketing', label: 'Marketing', icon: '<path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>' },
    { id: 'people', label: 'Học viên', icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>' },
    { id: 'questions', label: 'Câu hỏi', icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h6"/>' },
  ];
  /* ---------------- state ---------------- */
  const freshFilters = () => ({ source: '', position: '', mgmtExp: '', session: '' });
  const state = {
    all: [], events: [], byEvent: new Map(),
    route: readRoute(),
    filters: freshFilters(),
    q: { theme: null, word: null, hideEmpty: true, limit: 0, onlyHl: false, sort: 'ts', dir: -1 },
    hl: loadHl(),
    matrixDim: 'mgmtExp', peopleMatrix: 'expTeam', pendingQ: false,
    summaries: {}, ads: null, targets: {},
    lastFetch: null, lastHash: null, knownIds: null, error: null, loading: false,
    sourceColor: new Map(), eventColor: new Map(),
  };
  let charts = [];

  function readRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    let i = 0;
    const r = { view: 'overview', event: null, sub: 'overview' };
    if (parts[0] === 'event' && parts[1]) { r.view = 'event'; r.event = parts[1]; i = 2; }
    if (SUBS.some(t => t.id === parts[i])) r.sub = parts[i];
    return r;
  }
  const routeHash = (r, sub) => `#/${r.view === 'event' ? `event/${encodeURIComponent(r.event)}/` : ''}${sub && sub !== 'overview' ? sub : ''}`;

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
      raw += JSON.stringify(state.summaries) + JSON.stringify(state.ads) + JSON.stringify(state.targets);
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
    const bin = isNarrow() ? 3 : 1;              // điện thoại: gộp khung 3 tiếng cho vừa màn hình
    const cols = 24 / bin;
    const grid = DOW_ROWS.map(() => new Array(cols).fill(0));
    for (const r of rows) grid[DOW_ROWS.indexOf(r.ts.getDay())][Math.floor(r.ts.getHours() / bin)]++;
    const max = Math.max(1, ...grid.flat());
    let html = `<div class="heat-wrap"><div class="heat${bin > 1 ? ' heat-bin' : ''}" style="grid-template-columns:34px repeat(${cols}, minmax(${bin > 1 ? 26 : 16}px, 1fr))"><div></div>`;
    for (let c = 0; c < cols; c++) html += `<div class="hh">${bin > 1 || c % 3 === 0 ? c * bin + 'h' : ''}</div>`;
    DOW_ROWS.forEach((d, ri) => {
      html += `<div class="hl">${DOW[d]}</div>`;
      for (let c = 0; c < cols; c++) {
        const v = grid[ri][c];
        html += `<div class="cell" style="background:var(--seq-${seqStep(v, max)})" data-tip="${DOW[d]} · ${c * bin}h–${(c + 1) * bin}h: ${v} đăng ký"></div>`;
      }
    });
    html += '</div></div>';
    html += `<div class="scale">Ít ${[0, 1, 2, 3, 4, 5, 6].map(i => `<i style="background:var(--seq-${i})"></i>`).join('')} Nhiều <span style="margin-left:auto">Cao nhất: ${max}/ô${bin > 1 ? ` · ô = ${bin} tiếng` : ''}</span></div>`;
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
    return `<section class="section"><div class="section-head"><h2>${num ? `<span class="num">${num}</span> ` : ''}${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>${body}</section>`;
  }

  function kpi(label, value, sub, hero) {
    return `<div class="kpi${hero ? ' hero' : ''}"><div class="k-label">${label}</div><div class="k-value">${value}</div>${sub ? `<div class="k-sub">${sub}</div>` : ''}</div>`;
  }

  /* ---------------- tóm tắt đầu trang: thẻ buổi + KPI ---------------- */
  // Mục tiêu mỗi buổi: số nhập trên dashboard (lưu chung trong tab "MUC_TIEU" của Sheet qua Apps Script)
  // → config.js → mặc định. Chưa dùng Apps Script thì đành lưu trong trình duyệt của người nhập.
  const TARGET_KEY = 'wd-target:';
  function sessionTarget(ev, label) {
    const key = `${ev}|${label}`;
    if (state.targets[key] > 0) return state.targets[key];
    if (!CFG.appsScriptUrl) {
      try { const v = parseInt(localStorage.getItem(TARGET_KEY + key), 10); if (v > 0) return v; } catch (e) { /* trình duyệt chặn lưu trữ */ }
    }
    const conf = (CFG.events && CFG.events[ev]) || {};
    return (conf.targets && conf.targets[label]) || conf.target || CFG.defaultTarget || 100;
  }
  async function saveTarget(ev, label, v) {
    const key = `${ev}|${label}`;
    if (!CFG.appsScriptUrl) {
      try { localStorage.setItem(TARGET_KEY + key, String(v)); } catch (e) { /* trình duyệt chặn lưu trữ */ }
      render(true); return;
    }
    const prev = state.targets[key];
    state.targets[key] = v; render(true);   // hiện ngay, lưu ngầm
    try {
      // text/plain để trình duyệt không gửi preflight CORS — Apps Script không trả lời OPTIONS
      const res = await fetch(CFG.appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'setTarget', key, target: v }) });
      let out = {};
      try { out = await res.json(); } catch (e) { throw new Error('Apps Script chưa có hàm lưu mục tiêu — cập nhật Code.gs bản mới'); }
      if (!out.ok) throw new Error(out.error || 'lỗi không rõ');
      toast(`Đã lưu mục tiêu ${fmt(v)} người — cả team đều thấy`);
    } catch (e) {
      if (prev) state.targets[key] = prev; else delete state.targets[key];
      render(true);
      toast(`Không lưu được mục tiêu: ${e.message}`);
    }
  }

  function sessionsOf(base) {
    const m = new Map();
    for (const r of base) {
      if (!r.session.date) continue;
      const k = `${r.event}|${r.session.label}`;
      if (!m.has(k)) m.set(k, { event: r.event, label: r.session.label, start: r.session.date, end: r.session.end, time: r.session.time });
    }
    return [...m.values()].sort((a, b) => a.start - b.start);
  }

  function countdownHtml(start, end) {
    const now = Date.now();
    if (now >= end) return '<span class="cd-done">Đã diễn ra</span>';
    if (now >= start) return '<span class="cd-live">● Đang diễn ra</span>';
    const ms = start - now, d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000), mi = Math.floor((ms % 3600000) / 60000);
    return d > 0 ? `Còn <b>${d}</b> ngày ${h} giờ` : `Còn <b>${h}</b> giờ ${mi} phút`;
  }

  function sessionCards(base, rows, multi) {
    let list = sessionsOf(base);
    if (state.filters.session) list = list.filter(s => s.label === state.filters.session);
    if (multi) { const upcoming = list.filter(s => +s.end > Date.now()); if (upcoming.length) list = upcoming; }
    if (!list.length) return '';
    return `<div class="sessions">${list.map(s => {
      const n = rows.filter(r => r.event === s.event && r.session.label === s.label).length;
      const target = sessionTarget(s.event, s.label);
      const p = pct(n, target);
      const d = s.start;
      return `<div class="sess${+s.end <= Date.now() ? ' past' : ''}">
        <div class="sess-top">
          <div class="cal"><div class="cal-m">Tháng ${d.getMonth() + 1}</div><div class="cal-d">${d.getDate()}</div><div class="cal-w">${DOW[d.getDay()]}</div></div>
          <div class="sess-info">
            ${multi ? `<div class="sess-ev">${esc(eventTitle(s.event))}</div>` : ''}
            <h3>${s.time ? `${s.time.replace('–', ' đến ')}, ` : ''}${DOW[d.getDay()]} ${dayLabel(d)}</h3>
            <p class="s-cd" data-start="${+s.start}" data-end="${+s.end}">${countdownHtml(+s.start, +s.end)}</p>
            <p class="s-n"><b>${fmt(n)}</b> người đăng ký</p>
          </div>
        </div>
        <div class="s-track" data-tip="${fmt(n)}/${fmt(target)} người"><div class="s-fill${p >= 100 ? ' done' : ''}" style="width:${Math.min(100, p)}%"></div></div>
        <div class="s-foot"><span>Đạt ${p}% mục tiêu</span>
          <label>Mục tiêu <input type="number" min="1" step="1" inputmode="numeric" value="${target}" data-target-ev="${esc(s.event)}" data-target-label="${esc(s.label)}" aria-label="Mục tiêu số người đăng ký"> người</label></div>
      </div>`;
    }).join('')}</div>`;
  }

  function headKpis(rows, heroSub, span, extra = '') {
    const n = rows.length, now = Date.now();
    const w7 = rows.filter(r => now - r.ts < 7 * DAY).length;
    const mg = rows.filter(isManaging).length;
    return `<div class="kpis ${extra ? 'k6' : 'k5'}">
      ${kpi('Tổng lượt đăng ký', fmt(n), heroSub, true)}
      ${kpi('Trong 24 giờ qua', fmt(last24(rows).cur), 'đăng ký mới')}
      ${kpi('Trong 7 ngày qua', fmt(w7), `bình quân ${(w7 / Math.min(7, span)).toFixed(1)} mỗi ngày`)}
      ${kpi('Bình quân từ ngày mở', (n / span).toFixed(1), `mỗi ngày, qua ${span} ngày`)}
      ${kpi('Đang phụ trách người', `${pct(mg, n)}%`, `${fmt(mg)} người có nhóm riêng`)}
      ${extra}
    </div>`;
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
    const nOn = Object.values(state.filters).filter(Boolean).length;
    const wasOpen = $('#filters details') ? $('#filters details').open : false;
    $('#filters').innerHTML = `<details class="fbox"${!isNarrow() || wasOpen ? ' open' : ''}>
      <summary>Bộ lọc${nOn ? ` <b>${nOn} đang bật</b>` : ''}</summary><div class="frow">${html}</div></details>`;
  }

  function renderTabs() {
    const r = state.route;
    let html = `<a href="#/" class="${r.view === 'overview' ? 'active' : ''}">Tổng quan chuỗi<span class="count">${state.all.length}</span></a>`;
    for (const ev of state.events) {
      html += `<a href="#/event/${encodeURIComponent(ev)}" class="${r.view === 'event' && r.event === ev ? 'active' : ''}">${esc(eventTitle(ev))}<span class="count">${state.byEvent.get(ev).length}</span></a>`;
    }
    $('#tabs').innerHTML = html;
    const act = $('#tabs a.active');
    if (act) $('#tabs').scrollLeft = act.offsetLeft - 16;
  }

  function renderSubtabs() {
    const r = state.route;
    $('#subtabs').innerHTML = SUBS.map(t => `<a href="${routeHash(r, t.id)}" class="${r.sub === t.id ? 'active' : ''}"${r.sub === t.id ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t.icon}</svg>${t.label}</a>`).join('');
  }

  function render(keepScroll) {
    const y = window.scrollY;
    charts.forEach(c => c.destroy()); charts = [];
    if (state.route.view === 'event' && !state.byEvent.has(state.route.event)) state.route = { view: 'overview', event: null, sub: state.route.sub };
    renderTabs();
    renderSubtabs();
    const isEvent = state.route.view === 'event';
    const base = isEvent ? state.byEvent.get(state.route.event) : state.all;
    renderFilters(base);
    const rows = filterRows(base);
    $('#subtitle').textContent = isEvent ? eventTitle(state.route.event) : `Tổng quan chuỗi · ${state.events.length} sự kiện`;
    if (!state.all.length) { $('#view').innerHTML = '<div class="state"><h2>Chưa có đăng ký nào</h2><p>Sheet đang trống — dashboard sẽ tự cập nhật khi có dữ liệu.</p></div>'; return; }

    let html;
    switch (state.route.sub) {
      case 'marketing': html = sectionMomentum(rows, isEvent) + sectionSource(rows) + sectionAds(base, isEvent); break;
      case 'people': html = peopleTab(rows, isEvent); break;
      case 'questions': html = aiSummaryBox(isEvent ? state.route.event : '__overview__') + sectionConcerns(rows); break;
      default: html = (isEvent ? eventHeader(rows, base) : overviewHeader(rows)) + insightPanel(rows, isEvent ? 'event' : 'overview') + quickGrid(rows, isEvent) + (isEvent ? '' : compareTable());
    }
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
    const span = n ? Math.max(1, Math.round((startOfDay(new Date()) - startOfDay(rows[0].ts)) / DAY) + 1) : 1;
    return sessionCards(state.all, rows, true)
      + headKpis(rows, `${fmt(people.size)} người duy nhất${repeat ? ` · ${fmt(repeat)} người đi ≥ 2 sự kiện` : ''}`, span, costKpi(state.all, false))
      + budgetCard(state.all, false);
  }

  function compareTable() {
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
    return section('', 'So sánh các sự kiện', 'Bấm vào một dòng để mở dashboard riêng của sự kiện đó',
      `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>Sự kiện</th><th>Buổi đầu tiên</th><th class="n">Còn lại</th><th class="n">Đăng ký</th><th class="n">24h</th><th class="n">TB/ngày</th>
        <th class="n">% quản lý</th><th class="n">Consent</th><th>Lĩnh vực #1</th><th>Bận tâm #1</th><th>Kênh #1</th>
      </tr></thead><tbody>${trs}</tbody></table></div></div>`);
  }

  function eventHeader(rows, base) {
    const n = rows.length;
    const { start } = eventDates(base);
    const span = n ? Math.max(1, Math.round((startOfDay(new Date(Math.min(Date.now(), start ? +start : Date.now()))) - startOfDay(rows[0].ts)) / DAY) + 1) : 1;
    const dup = duplicates(rows);
    return sessionCards(base, rows, false)
      + headKpis(rows, dup ? `${fmt(n - dup)} người · gộp ${fmt(dup)} lượt trùng` : 'Không có lượt trùng', span, costKpi(base, true))
      + budgetCard(base, true);
  }

  // Biểu đồ đăng ký theo ngày + kênh / mối bận tâm hàng đầu — phần "nhìn nhanh" của tab Tổng quan
  function dailyLegend(rows, isEvent) {
    if (!isEvent) return state.events.map(ev => ({ label: eventTitle(ev), color: state.eventColor.get(ev) }));
    const order = [...state.sourceColor.keys()];
    return toItems(countBy(rows, r => r.source || UNKNOWN)).map(i => i.label).sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map(g => ({ label: g, color: state.sourceColor.get(g) || '--c-other' }));
  }

  function quickGrid(rows, isEvent) {
    const n = rows.length;
    const withQ = rows.filter(r => !r.noConcern);
    const srcItems = toItems(countBy(rows, r => r.source)).slice(0, 5);
    const themeItems = toItems(countBy(withQ, r => r.themes)).filter(i => i.label !== 'other').slice(0, 5).map(i => ({ ...i, key: i.label, label: themeLabel(i.label) }));
    const goTo = (sub, text) => `<a class="card-link" href="${routeHash(state.route, sub)}">${text} →</a>`;
    return `<div class="grid g-7-5 quick">
      ${card('Đăng ký theo ngày', isEvent ? `Chia theo kênh · ${hoverWord} vào cột để xem luỹ kế` : 'Chia theo sự kiện', legend(dailyLegend(rows, isEvent)) + '<div class="chart-box"><canvas id="chDaily"></canvas></div>')}
      <div class="col-stack">
        ${card('Kênh mang về đăng ký', '', barList(srcItems, { total: n, limit: 99, colorFn: i => state.sourceColor.get(i.label) || '--c-other' }) + goTo('marketing', 'Chi tiết kênh & quảng cáo'))}
        ${card('Mối bận tâm hàng đầu', `${withQ.length}/${n} người có câu hỏi cụ thể`, barList(themeItems, { total: withQ.length, limit: 99, click: 'theme-id', colorFn: i => themeColor(i.key) }) + goTo('questions', 'Xem câu hỏi'))}
      </div>
    </div>`;
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
      <details class="more-box"${isNarrow() ? '' : ' open'}><summary>Xem chi tiết: họ là ai, đang lo gì, nên làm gì</summary>
      <div class="ai-grid">
        <div>${s.who ? `<h4>Họ là ai</h4><p>${esc(s.who)}</p>` : ''}${s.trend ? `<h4>Nhịp đăng ký</h4><p>${esc(s.trend)}</p>` : ''}</div>
        <div>${(s.concerns || []).length ? `<h4>Họ đang lo điều gì</h4><ol>${s.concerns.map(c => `<li><b>${esc(c.title)}</b>${c.detail ? ` — ${esc(c.detail)}` : ''}${c.quote ? `<q>${esc(c.quote)}</q>` : ''}</li>`).join('')}</ol>` : ''}</div>
        <div>${(s.actions || []).length ? `<h4>Nên làm hôm nay</h4><ul class="ai-act">${li(s.actions)}</ul>` : ''}${(s.watch || []).length ? `<h4>Cần để ý</h4><ul class="ai-watch">${li(s.watch)}</ul>` : ''}</div>
      </div></details>
    </div>`;
  }

  // Tab Tổng quan: 1 khung nhận định — tiêu đề AI + việc nên làm, số liệu nhanh thu gọn bên dưới
  function insightPanel(rows, scope) {
    const ins = buildInsights(rows, scope);
    const list = ins.length ? `<ul class="ins-list">${ins.map(i => `<li class="${i.warn ? 'warn' : ''}">${i.html}</li>`).join('')}</ul>` : '';
    const s = state.summaries && state.summaries[scope === 'event' ? state.route.event : '__overview__'];
    if (!s || !s.headline) return list ? `<div class="insights"><h3>Nhận định nhanh</h3>${list}</div>` : '';
    const at = s.generatedAt ? new Date(s.generatedAt) : null;
    const when = at && !isNaN(at) ? `${pad(at.getHours())}:${pad(at.getMinutes())} ${dayLabel(at)}` : '';
    const li = arr => (arr || []).map(x => `<li>${esc(x)}</li>`).join('');
    return `<div class="ai-sum">
      <div class="ai-head"><span class="ai-badge">Tóm tắt AI hằng ngày</span><span class="ai-meta">${when ? `viết lúc ${when}` : ''}</span>
        <a class="card-link ai-more" href="${routeHash(state.route, 'questions')}">Phân tích đầy đủ →</a></div>
      <p class="ai-headline">${esc(s.headline)}</p>
      ${(s.actions || []).length || (s.watch || []).length ? `<div class="ai-grid ai-grid-2">
        <div>${(s.actions || []).length ? `<h4>Nên làm hôm nay</h4><ul class="ai-act">${li(s.actions)}</ul>` : ''}</div>
        <div>${(s.watch || []).length ? `<h4>Cần để ý</h4><ul class="ai-watch">${li(s.watch)}</ul>` : ''}</div>
      </div>` : ''}
      ${list ? `<details class="quick-facts"><summary>Số liệu nhanh · ${ins.length} ý, cập nhật liên tục</summary>${list}</details>` : ''}
    </div>`;
  }

  function sectionMomentum(rows, isEvent) {
    const body = `<div class="grid g2">
      ${isEvent
        ? card('Đăng ký luỹ kế', 'Tổng số người đã đăng ký theo thời gian', '<div class="chart-box"><canvas id="chCum"></canvas></div>')
        : card('Tốc độ đăng ký giữa các sự kiện', 'Luỹ kế theo số ngày trước buổi đầu tiên — sự kiện nào “nóng” hơn', legend(dailyLegend(rows, false)) + '<div class="chart-box"><canvas id="chPace"></canvas></div>')}
      ${card('Giờ vàng đăng ký', 'Ngày trong tuần × giờ — lúc khán giả online để đăng bài, gửi nhắc', heatmap(rows))}
    </div>`;
    return section('', 'Nhịp đăng ký', 'Tốc độ tích luỹ và khung giờ học viên hay đăng ký', body);
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
      return `<tr><td class="ch"><span class="legend" style="margin:0"><span><i style="background:var(${state.sourceColor.get(i.label) || '--c-other'})"></i><b>${esc(i.label)}</b></span></span></td>
        <td class="n" data-label="Đăng ký">${g.length}</td><td class="n" data-label="Tỉ trọng">${pct(g.length, n)}%</td>
        <td class="n" data-label="Đang quản lý">${pct(g.filter(isManaging).length, g.length)}%</td>
        <td class="n" data-label="KN QL > 3 năm">${pct(g.filter(isSenior).length, g.length)}%</td>
        <td class="n" data-label="Có câu hỏi cụ thể">${pct(g.filter(r => !r.noConcern).length, g.length)}%</td>
        <td class="n" data-label="Consent">${pct(g.filter(r => r.consent === 'yes').length, g.length)}%</td></tr>`;
    }).join('');
    const cityCard = CFG.columns.city != null ? card('Tỉnh / Thành phố', '', barList(toItems(countBy(rows, r => r.city)), { total: n })) : '';
    const body = `<div class="grid ${cityCard ? 'g3' : 'g2'}">
      ${card('Kênh (utm_source)', 'Học viên biết đến sự kiện từ đâu', barList(srcItems, { total: n, colorFn: i => state.sourceColor.get(i.label) || '--c-other' }))}
      ${card('Chiến dịch (utm_campaign)', 'Bài đăng / chiến dịch cụ thể mang về đăng ký', barList(campItems, { total: n, subFn: i => i.src ? `qua ${i.src}` : '' }))}
      ${cityCard}
      <div class="card" style="grid-column:1/-1"><h3>Chất lượng theo kênh</h3><p class="hint">Kênh nào mang về đúng chân dung mục tiêu: đang quản lý, có kinh nghiệm, có vấn đề cụ thể</p>
        <div class="tbl-wrap"><table class="tbl tbl-cards"><thead><tr><th>Kênh</th><th class="n">Đăng ký</th><th class="n">Tỉ trọng</th><th class="n">% đang quản lý</th><th class="n">% KN quản lý > 3 năm</th><th class="n">% có câu hỏi cụ thể</th><th class="n">% consent</th></tr></thead><tbody>${quality}</tbody></table></div></div>
    </div>`;
    return section('', 'Kênh & chiến dịch', 'Học viên đến từ đâu và kênh nào mang về đúng người', body);
  }

  const adsMoney = v => (state.ads && state.ads.currency && state.ads.currency !== 'USD'
    ? `${fmt(Math.round(v))} ${state.ads.currency}` : `$${v.toFixed(v > 0 && v < 0.01 ? 4 : 2)}`);
  const adsSum = (list, k) => list.reduce((s, a) => s + a[k], 0);
  const adsLeads = list => list.filter(a => isLeadType(a.resultType)).reduce((s, a) => s + a.results, 0);
  const adsOf = isEvent => (state.ads ? state.ads.rows.filter(a => !isEvent || adEvent(a) === state.route.event) : []);

  function adsStats(base, ads) {
    const spend = adsSum(ads, 'spend'), leads = adsLeads(ads);
    // Click / CTR / CPC chỉ tính chiến dịch ra lead — chiến dịch ThruPlay không tối ưu cho click
    const leadCamps = new Set(ads.filter(a => isLeadType(a.resultType)).map(a => a.campaign));
    const leadAds = leadCamps.size ? ads.filter(a => leadCamps.has(a.campaign)) : ads;
    // Đăng ký đến từ quảng cáo: kênh Facebook/Instagram + utm_campaign khớp tên chiến dịch quảng cáo
    const camps = [...new Set(ads.map(a => normKey(a.campaign)))];
    const utmList = adsCfg().utmCampaigns;
    const fromAds = r => META_SOURCES.includes(r.source) && (utmList
      ? utmList.some(u => normKey(u) === normKey(r.campaign))
      : normKey(r.campaign).length >= 4 && camps.some(c => c.includes(normKey(r.campaign))));
    const regs = base.filter(fromAds);
    const starts = ads.map(a => a.reportStart).filter(Boolean), ends = ads.map(a => a.reportEnd).filter(Boolean);
    return {
      spend, leads, leadAds, regs,
      clicks: adsSum(leadAds, 'clicks'), impr: adsSum(leadAds, 'impressions'),
      utms: [...new Set(regs.map(r => r.campaign))],
      period: starts.length && ends.length ? `${dayLabel(new Date(Math.min(...starts)))} – ${dayLabel(new Date(Math.max(...ends)))}` : '',
    };
  }

  // Ô "Chi phí / 1 đăng ký" ở đầu trang — chỉ hiện khi có dữ liệu quảng cáo
  function costKpi(base, isEvent) {
    const ads = adsOf(isEvent);
    if (!ads.length) return '';
    const { spend, regs } = adsStats(base, ads);
    return regs.length
      ? kpi('Chi phí / 1 đăng ký', adsMoney(spend / regs.length), `${adsMoney(spend)} ÷ ${fmt(regs.length)} người từ quảng cáo`)
      : kpi('Chi phí / 1 đăng ký', base.length ? adsMoney(spend / base.length) : '—', `${adsMoney(spend)} ÷ ${fmt(base.length)} đăng ký mọi kênh`);
  }

  // Ngân sách quảng cáo cần thêm để các buổi sắp tới đạt mục tiêu
  const CPA_KEY = 'wd-cpa:';
  function savedCpa(scope) { try { const v = parseFloat(localStorage.getItem(CPA_KEY + scope)); return v > 0 ? v : null; } catch (e) { return null; } }
  function saveCpa(scope, v) { try { if (v > 0) localStorage.setItem(CPA_KEY + scope, String(v)); else localStorage.removeItem(CPA_KEY + scope); } catch (e) { /* trình duyệt chặn lưu trữ */ } }

  function budgetCard(base, isEvent) {
    const ads = adsOf(isEvent);
    if (!ads.length || !base.length) return '';
    const { spend, regs } = adsStats(base, ads);
    if (!regs.length) return '';
    const now = Date.now();
    const sess = sessionsOf(base).filter(s => +s.end > now);
    if (!sess.length) return '';
    const scope = isEvent ? state.route.event : '__all__';
    const count = s => base.filter(r => r.event === s.event && r.session.label === s.label).length;
    const target = sess.reduce((t, s) => t + sessionTarget(s.event, s.label), 0);
    const have = sess.reduce((t, s) => t + count(s), 0);
    const gap = sess.reduce((t, s) => t + Math.max(0, sessionTarget(s.event, s.label) - count(s)), 0);
    const daysLeft = Math.max(1, Math.ceil((Math.max(...sess.map(s => +s.start)) - now) / DAY));
    // nhịp đăng ký KHÔNG qua quảng cáo trong 7 ngày gần nhất
    const fromAds = new Set(regs);
    const opened = Math.max(1, Math.ceil((now - base[0].ts) / DAY));
    const orgPerDay = base.filter(r => !fromAds.has(r) && now - r.ts < 7 * DAY).length / Math.min(7, opened);
    const organic = Math.min(gap, Math.round(orgPerDay * daysLeft));
    const needAds = Math.max(0, gap - organic);
    const cpaActual = spend / regs.length;
    const cpa = savedCpa(scope) || cpaActual;
    const budget = needAds * cpa;
    const fx = adsCfg().fxRate;
    const vnd = v => (fx ? ` <small>≈ ${fmt(Math.round((v * fx) / 1000))}k ₫</small>` : '');
    const main = gap === 0
      ? `<div class="bg-big ok">Đã đủ mục tiêu</div><div class="bg-sub">Các buổi sắp tới đã đạt ${fmt(have)}/${fmt(target)} người — không cần thêm ngân sách để đạt KPI.</div>`
      : needAds === 0
        ? `<div class="bg-big ok">$0</div><div class="bg-sub">Với nhịp đăng ký tự nhiên hiện tại (~${orgPerDay.toFixed(1)}/ngày), các buổi có thể đạt mục tiêu mà không cần thêm quảng cáo.</div>`
        : `<div class="bg-big">${adsMoney(budget)}${vnd(budget)}</div>
           <div class="bg-sub">≈ <b>${adsMoney(budget / daysLeft)}/ngày</b>${vnd(budget / daysLeft)} trong ${daysLeft} ngày còn lại · tổng cả chiến dịch ≈ <b>${adsMoney(spend + budget)}</b> (đã chi ${adsMoney(spend)})</div>`;
    return `<div class="card budget">
      <div class="bg-main">
        <div class="bg-label">Ngân sách quảng cáo cần thêm để đạt mục tiêu</div>
        ${main}
        <label class="bg-cpa">Chi phí / 1 đăng ký giả định
          <input type="number" min="0" step="0.01" inputmode="decimal" value="${cpa.toFixed(2)}" data-cpa="${esc(scope)}" aria-label="Chi phí cho mỗi đăng ký từ quảng cáo">
          <span>thực tế ${adsMoney(cpaActual)}${savedCpa(scope) ? ` · <button type="button" data-cpa-reset="${esc(scope)}">dùng số thực tế</button>` : ''}</span></label>
      </div>
      <ol class="bg-steps">
        <li><span>Mục tiêu ${sess.length} buổi sắp tới</span><b>${fmt(target)}</b></li>
        <li><span>Đã đăng ký</span><b>${fmt(have)}</b></li>
        <li><span>Còn thiếu <small>(tính riêng từng buổi)</small></span><b>${fmt(gap)}</b></li>
        <li><span>Dự kiến tự đến, không qua quảng cáo <small>${orgPerDay.toFixed(1)}/ngày × ${daysLeft} ngày</small></span><b>−${fmt(organic)}</b></li>
        <li class="tot"><span>Cần từ quảng cáo × chi phí / đăng ký</span><b>${fmt(needAds)} × ${adsMoney(cpa)}</b></li>
      </ol>
    </div>`;
  }

  function sectionAds(base, isEvent) {
    const desc = 'Chi tiêu, lead và chi phí trên mỗi đăng ký — lấy từ tab “Facebook Ads” trong Sheet';
    if (!state.ads) {
      return section('', 'Quảng cáo Facebook', desc, card('Chưa có dữ liệu quảng cáo', '', `<div class="note">Dashboard chưa nhận được tab <b>“${esc(adsCfg().sheetName)}”</b>. Dán <b>Code.gs</b> bản mới (có hàm <b>readAdsSheet_</b>) vào Apps Script rồi deploy bản mới — xem mục “Chi phí quảng cáo” trong HUONG-DAN.md.</div>`));
    }
    const ads = adsOf(isEvent);
    if (!ads.length) return section('', 'Quảng cáo Facebook', desc, card('Chưa có quảng cáo cho sự kiện này', '', `<div class="note">Tab “${esc(adsCfg().sheetName)}” chưa có chiến dịch nào có tên chứa “${esc(state.route.event)}”. Nếu tên chiến dịch đặt khác, khai báo trong <b>config.js → ads.eventOf</b>.</div>`));

    const { spend, leads, leadAds, clicks, impr, regs, utms, period } = adsStats(base, ads);
    const fx = adsCfg().fxRate;
    const vnd = v => { const d = v * fx; return d >= 1e6 ? `${(d / 1e6).toFixed(2).replace('.', ',')} tr ₫` : `${fmt(Math.round(d / 1000))}k ₫`; };
    const sum = adsSum, leadsOf = adsLeads, money = adsMoney;
    const per = (a, b) => (b ? money(a / b) : '—');

    const tiles = `<div class="kpis k5">
      ${kpi('Đã chi tiêu', money(spend), [period, fx ? `≈ ${vnd(spend)}` : '', `${ads.length} quảng cáo`].filter(Boolean).join(' · '))}
      ${kpi('Lead theo Meta', fmt(leads), leads ? `${per(spend, leads)} mỗi lead` : 'chưa có lead')}
      ${kpi('Đăng ký từ quảng cáo', fmt(regs.length), regs.length ? `${per(spend, regs.length)} mỗi đăng ký${utms.length ? ` · utm ${utms.map(esc).join(', ')}` : ''}` : 'chưa khớp được utm_campaign')}
      ${kpi('Chi phí / mọi đăng ký', per(spend, base.length), `chia cho ${fmt(base.length)} đăng ký mọi kênh`)}
      ${kpi('Click vào liên kết', fmt(clicks), `CTR ${impr ? ((clicks * 100) / impr).toFixed(2) : 0}% · CPC ${per(sum(leadAds, 'spend'), clicks)}`)}
    </div>`;

    const group = (list, keyFn) => {
      const m = new Map();
      for (const a of list) {
        const k = keyFn(a) || UNKNOWN;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(a);
      }
      return [...m].map(([label, g]) => ({ label, spend: sum(g, 'spend'), clicks: sum(g, 'clicks'), impr: sum(g, 'impressions'), leads: leadsOf(g), g }))
        .sort((x, y) => y.spend - x.spend);
    };
    const table = (items, first, resultCol) => {
      const ok = items.filter(i => i.leads >= 3);
      const best = ok.length > 1 ? ok.reduce((b, i) => (i.spend / i.leads < b.spend / b.leads ? i : b)) : null;
      const maxSpend = Math.max(...items.map(i => i.spend), 0.01);
      return `<div class="tbl-wrap"><table class="tbl tbl-cards ads-tbl"><thead><tr><th>${first}</th><th class="n">Chi tiêu</th><th class="n">${resultCol}</th><th class="n">Chi phí / ${resultCol.toLowerCase()}</th><th class="n">Click</th><th class="n">CTR</th></tr></thead><tbody>
        ${items.map(i => {
          const res = resultCol === 'Lead' ? i.leads : i.g.reduce((s, a) => s + a.results, 0);
          const type = resultCol === 'Lead' ? '' : [...new Set(i.g.map(a => a.resultType).filter(Boolean))].join(', ');
          return `<tr><td class="ch"><b>${esc(i.label)}</b>${i === best ? ' <span class="pill ok">rẻ nhất</span>' : ''}${type ? `<small class="sub">${esc(type)}</small>` : ''}
            <div class="mini"><i style="width:${(i.spend / maxSpend) * 100}%"></i></div></td>
            <td class="n" data-label="Chi tiêu">${money(i.spend)}</td>
            <td class="n" data-label="${resultCol}">${res ? fmt(res) : '—'}</td>
            <td class="n" data-label="Chi phí / ${resultCol.toLowerCase()}">${res ? money(i.spend / res) : '—'}</td>
            <td class="n" data-label="Click">${i.clicks ? fmt(i.clicks) : '—'}</td>
            <td class="n" data-label="CTR">${i.impr && i.clicks ? `${((i.clicks * 100) / i.impr).toFixed(2)}%` : '—'}</td></tr>`;
        }).join('')}</tbody></table></div>`;
    };
    const note = `Meta đếm <b>${fmt(leads)}</b> lead, Sheet ghi nhận <b>${fmt(regs.length)}</b> đăng ký có utm khớp chiến dịch. Chênh lệch nhỏ là bình thường (người bấm gửi nhiều lần, chặn cookie, đổi thiết bị). Số liệu quảng cáo là luỹ kế theo kỳ báo cáo của tab “${esc(adsCfg().sheetName)}”, không áp dụng bộ lọc phía trên.`;
    const body = `${tiles}
      <div class="grid g2" style="margin-top:16px">
        ${card('Theo chiến dịch', 'Mỗi chiến dịch tối ưu cho một loại kết quả khác nhau', table(group(ads, a => a.campaign), 'Chiến dịch', 'Kết quả'), 'span2')}
        ${card('Theo nhóm quảng cáo (đối tượng)', 'Chỉ tính chiến dịch ra lead · “rẻ nhất” = chi phí / lead thấp nhất, từ 3 lead trở lên', table(group(leadAds, a => a.adset), 'Nhóm quảng cáo', 'Lead'))}
        ${card('Theo mẫu quảng cáo (nội dung)', 'Gộp cùng một mẫu chạy ở nhiều nhóm · chỉ tính chiến dịch ra lead', table(group(leadAds, a => a.ad), 'Mẫu quảng cáo', 'Lead'))}
      </div>
      <div class="note">${note}</div>`;
    return section('', 'Quảng cáo Facebook', desc, body);
  }

  function peopleTab(rows, isEvent) {
    const n = rows.length;
    const order = CFG.order;
    const expItems = toItems(countBy(rows, r => r.mgmtExp), order.mgmtExp);
    const teamItems = toItems(countBy(rows, r => r.teamSize), order.teamSize);
    const mini = (title, items, opts = {}) => `<div class="mini-block"><h4>${title}</h4>${barList(items, { total: n, ...opts })}</div>`;
    const portrait = `<div class="card"><div class="grid g2 inner">
      ${mini('Vị trí / cấp bậc', toItems(countBy(rows, r => r.position)))}
      ${mini('Độ tuổi (theo năm sinh)', toItems(countBy(rows, r => r.cohort), COHORTS), { subFn: i => cohortSub(i.label) })}
      ${mini('Kinh nghiệm quản lý', expItems)}
      ${mini('Quy mô đội đang quản lý', teamItems)}
    </div></div>`;

    const nInd = rows.filter(r => r.industryByAi).length;
    const indHint = nInd
      ? `AI đã xếp ${nInd}/${n} người vào nhóm ngành chuẩn${nInd < n ? ' · số còn lại tạm gộp theo cách viết' : ''}`
      : 'Đã gộp các cách viết khác nhau. Một người có thể thuộc nhiều lĩnh vực.';
    const topInd = toItems(countBy(rows, r => r.industries)).filter(i => i.label !== UNKNOWN).slice(0, 8);
    const positions = toItems(countBy(rows, r => r.position));
    const matrices = {
      expTeam: { label: 'Kinh nghiệm quản lý × Quy mô đội', hint: 'Góc trên-trái: quản lý mới, đội nhỏ · góc dưới-phải: quản lý lâu năm, đội lớn',
        html: () => matrix(expItems.map(i => ({ label: i.label })), teamItems.map(i => ({ label: i.label })), (e, t) => rows.filter(r => (r.mgmtExp || UNKNOWN) === e && (r.teamSize || UNKNOWN) === t).length) },
      indPos: { label: 'Lĩnh vực × Vị trí', hint: 'Top 8 lĩnh vực theo cấp bậc',
        html: () => matrix(topInd.map(i => ({ label: i.label })), positions.map(i => ({ label: i.label })), (ind, pos) => rows.filter(r => r.industries.includes(ind) && (r.position || UNKNOWN) === pos).length) },
    };
    const m = matrices[state.peopleMatrix] || matrices.expTeam;
    const body = `<div class="grid g2">
      ${card('Lĩnh vực đang hoạt động', indHint, barList(toItems(countBy(rows, r => r.industries)), { total: n, limit: 12 }))}
      <div class="card"><div class="card-head"><div><h3>Tương quan</h3><p class="hint">${m.hint} · ô đậm = nhóm đông nhất</p></div>
        <select data-pmatrix aria-label="Chọn ma trận">${Object.entries(matrices).map(([k, x]) => `<option value="${k}"${x === m ? ' selected' : ''}>${x.label}</option>`).join('')}</select></div>${m.html()}</div>
    </div>`;
    return section('', 'Chân dung học viên', 'Cấp bậc, độ tuổi, kinh nghiệm và quy mô đội đang quản lý', portrait)
      + section('', 'Ngành nghề & tương quan', 'Học viên làm ở đâu và các nhóm giao nhau thế nào', body)
      + sectionOps(rows, isEvent);
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
        class="kw${state.q.word === w.word ? ' selected' : ''}" style="--kc:var(${themeColor(w.theme)});--fs:${sizeOf(w.value).toFixed(1)}px"
        data-tip="“${esc(w.word)}” · ${w.value} câu hỏi · nhóm: ${esc(themeLabel(w.theme))} · bấm để lọc"><i></i>${esc(w.word)}</button>`).join('')}</div>`
      : '<div class="empty">Chưa đủ câu hỏi để trích từ khoá</div>';

    const body = `<div class="grid g2">
      ${card('Nhóm vấn đề họ đang gặp', `${how} · ${withQ.length}/${rows.length} người có câu hỏi cụ thể · một câu có thể thuộc nhiều nhóm · bấm để xem câu hỏi`, barList(themeItems, { total: withQ.length, click: 'theme-id', selected: state.q.theme, limit: 20, colorFn: i => themeColor(i.key) }))}
      ${card('Từ khoá nổi bật', `${nAi ? 'Từ khoá do AI rút ra từ từng câu hỏi' : 'Cụm từ xuất hiện nhiều nhất trong câu hỏi'} · màu = nhóm vấn đề (như biểu đồ bên cạnh) · cỡ chữ = số câu hỏi nhắc tới · bấm để lọc`, cloud)}
      <div class="card span2"><div class="card-head"><div><h3>Vấn đề × ${esc(dim.label)}</h3><p class="hint">Mỗi nhóm người lo lắng điều gì khác nhau? Bấm tên vấn đề để xem câu hỏi.</p></div>
        <label class="hint" style="margin:0">Xem theo&nbsp;<select data-matrix>${Object.entries(dims).map(([k, d]) => `<option value="${k}"${k === state.matrixDim ? ' selected' : ''}>${d.label}</option>`).join('')}</select></label></div>${mx}</div>
      <div class="card span2" id="questions">${questionsBlock(rows)}</div>
    </div>`;
    return section('', 'Họ bận tâm điều gì', 'Phân loại câu hỏi / khó khăn học viên gửi về', body);
  }

  // Bảng câu hỏi kiểu Google Sheet: máy tính hiện hết trong khung cuộn, điện thoại hiện từng trang
  const qStep = () => (isNarrow() ? 15 : Infinity);
  const qLimit = () => state.q.limit || qStep();
  const HL_KEY = 'wd-highlight';
  function loadHl() {
    try { const v = JSON.parse(localStorage.getItem('wd-highlight') || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x).slice(0, 12) : []; } catch (e) { return []; }
  }
  function saveHl() { try { localStorage.setItem(HL_KEY, JSON.stringify(state.hl)); } catch (e) { /* trình duyệt chặn lưu trữ */ } }
  const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function qColumns(isEvent) {
    const ord = (list, v) => { const i = list.indexOf(v); return i < 0 ? 99 : i; };
    const cols = [
      { key: 'ts', label: 'Thời gian', val: r => +r.ts, cls: 'c-time', cell: r => `${dayLabel(r.ts)} ${pad(r.ts.getHours())}:${pad(r.ts.getMinutes())}` },
      { key: 'question', label: 'Câu hỏi / khó khăn', val: r => r.question.toLowerCase(), cls: 'c-q', cell: (r, mark) => `${mark(r.question || '(bỏ trống)')}${r.aiKeywords.length ? `<div class="kws">${r.aiKeywords.map(k => `<span class="k${state.q.word === k ? ' on' : ''}" data-word="${esc(k)}" title="Từ khoá AI · bấm để lọc">${esc(k)}</span>`).join('')}</div>` : ''}` },
      { key: 'theme', label: 'Nhóm vấn đề', val: r => r.themes.map(themeLabel).join(', '), cls: 'c-theme', cell: r => r.themes.filter(t => t !== 'other').map(t => `<span class="tag" style="--kc:var(${themeColor(t)})">${esc(themeLabel(t))}</span>`).join('') },
      { key: 'position', label: 'Vị trí', val: r => r.position, cls: 'nw', cell: r => esc(r.position) },
      { key: 'industry', label: 'Lĩnh vực', val: r => r.industries.join(', '), cls: 'c-ind', cell: r => `<span title="${esc(r.industryRaw ? `Học viên ghi: ${r.industryRaw}` : '')}">${esc(r.industries.join(', '))}</span>` },
      { key: 'mgmtExp', label: 'KN quản lý', val: r => ord(CFG.order.mgmtExp, r.mgmtExp), cls: 'nw', cell: r => esc(r.mgmtExp) },
      { key: 'teamSize', label: 'Quy mô đội', val: r => ord(CFG.order.teamSize, r.teamSize), cls: 'c-team', cell: r => esc(r.teamSize) },
      { key: 'age', label: 'Tuổi', val: r => (r.birthYear ? NOW_YEAR - r.birthYear : -1), cls: 'n', cell: r => (r.birthYear ? NOW_YEAR - r.birthYear : '') },
      { key: 'source', label: 'Kênh', val: r => r.source, cell: r => esc(r.source) },
    ];
    if (!isEvent) cols.push({ key: 'event', label: 'Sự kiện', val: r => r.event, cls: 'nw', cell: r => esc(eventTitle(r.event)) });
    return cols;
  }

  function questionsBlock(rows) {
    const q = state.q;
    const isEvent = state.route.view === 'event';
    let list = rows.slice();
    if (q.hideEmpty) list = list.filter(r => !r.noConcern);
    let themeHl = [];
    if (q.theme) { list = list.filter(r => r.themes.includes(q.theme)); themeHl = q.theme === 'other' ? [] : (CFG.themes.find(t => t.id === q.theme) || { keywords: [] }).keywords; }
    if (q.word) { list = list.filter(r => r.aiKeywords.includes(q.word) || r.question.toLowerCase().includes(q.word)); themeHl = [q.word]; }

    // Từ khoá người xem tự thêm: mỗi từ một màu; đếm số câu chứa từ đó
    const hl = state.hl;
    const hits = hl.map(w => list.filter(r => r.question.toLowerCase().includes(w)).length);
    if (q.onlyHl && hl.length) list = list.filter(r => hl.some(w => r.question.toLowerCase().includes(w)));

    const terms = [...hl.map((w, i) => ({ w, cls: `hl${(i % 6) + 1}` })), ...themeHl.filter(w => !hl.includes(w)).map(w => ({ w, cls: 'hl0' }))]
      .filter(t => t.w).sort((x, y) => y.w.length - x.w.length);
    const re = terms.length ? new RegExp(`(${terms.map(t => reEsc(esc(t.w))).join('|')})`, 'gi') : null;
    const clsOf = m => (terms.find(t => esc(t.w).toLowerCase() === m.toLowerCase()) || {}).cls || 'hl0';
    const mark = text => (re ? esc(text).replace(re, m => `<mark class="${clsOf(m)}">${m}</mark>`) : esc(text));

    const cols = qColumns(isEvent);
    const col = cols.find(c => c.key === q.sort) || cols[0];
    list.sort((x, y) => { const a = col.val(x), b = col.val(y); return (a < b ? -1 : a > b ? 1 : 0) * q.dir || (y.ts - x.ts); });
    const shown = list.slice(0, qLimit());

    const active = q.theme ? themeLabel(q.theme) : q.word ? `“${q.word}”` : '';
    const head = `<tr><th class="rn">#</th>${cols.map(c => `<th data-sort="${c.key}" class="${c.key === col.key ? 'sorted' : ''} ${c.cls || ''}" title="Bấm để sắp xếp">${c.label}${c.key === col.key ? (q.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr>`;
    const body = shown.map((r, i) => `<tr><td class="rn">${i + 1}</td>${cols.map(c => `<td class="${c.cls || ''}">${c.cell(r, mark)}</td>`).join('')}</tr>`).join('');

    return `<div class="card-head"><div><h3>Câu hỏi / khó khăn học viên gửi về</h3><p class="hint">Ẩn danh — chỉ hiện hồ sơ nghề nghiệp, không hiện tên / email / SĐT · bấm tiêu đề cột để sắp xếp</p></div></div>
      <div class="hl-bar">
        <form class="hl-form" data-hl-form autocomplete="off">
          <input name="hl" type="text" placeholder="Tô sáng từ khoá, cách nhau dấu phẩy — vd: giao việc, deadline" aria-label="Từ khoá cần tô sáng">
          <button type="submit">Tô sáng</button>
        </form>
        ${hl.length ? `<div class="hl-chips">${hl.map((w, i) => `<span class="hl-chip hl${(i % 6) + 1}">${esc(w)} <small>${hits[i]}</small><button type="button" data-hl-del="${i}" aria-label="Bỏ tô sáng ${esc(w)}">×</button></span>`).join('')}
          <button type="button" class="hl-clear" data-hl-clear>Xoá hết</button></div>` : ''}
      </div>
      <div class="q-toolbar"><div>${active ? `<span class="chip-on">Lọc: ${esc(active)}</span> <button type="button" data-clear-q>✕ Bỏ lọc</button> · ` : ''}<b>${list.length}</b> câu hỏi</div>
        <div class="q-opts">
          ${hl.length ? `<label><input type="checkbox" id="onlyHl" ${q.onlyHl ? 'checked' : ''}> Chỉ hiện câu có từ khoá tô sáng</label>` : ''}
          <label><input type="checkbox" id="hideEmpty" ${q.hideEmpty ? 'checked' : ''}> Ẩn câu “chưa có / không”</label>
        </div></div>
      ${list.length ? `<div class="q-sheet"><table class="q-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
        ${list.length > shown.length ? `<button type="button" class="more" data-more-q>Xem thêm ${Math.min(15, list.length - shown.length)} câu (còn ${list.length - shown.length})</button>` : ''}`
        : '<div class="empty">Không có câu hỏi phù hợp bộ lọc</div>'}`;
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
    return section('', 'Consent & chất lượng dữ liệu', isEvent ? '' : 'Toàn chuỗi', `<div class="grid g2">${card('Tình trạng consent form', '', consentBody)}${card('Chất lượng dữ liệu', 'Các điểm cần làm sạch trước khi gửi email / chia nhóm', dq)}</div>`);
  }

  function mountCharts(rows, isEvent) {
    if (!rows.length || !window.Chart) return;
    const start = isEvent ? eventDates(state.byEvent.get(state.route.event)).start : null;
    if ($('#chDaily')) {
      if (isEvent) {
        const groups = [...state.sourceColor.keys()].filter(s => rows.some(r => (r.source || UNKNOWN) === s));
        dailyStacked($('#chDaily'), rows, r => r.source || UNKNOWN, groups, g => state.sourceColor.get(g) || '--c-other', start);
      } else dailyStacked($('#chDaily'), rows, r => r.event, state.events, ev => state.eventColor.get(ev), null);
    }
    if ($('#chCum')) cumulativeLine($('#chCum'), rows, start);
    if ($('#chPace')) paceChart($('#chPace'));
  }

  /* ---------------- interactions ---------------- */
  const view = $('#view');
  function rerenderKeep(scrollToQuestions) {
    render(true);
    if (scrollToQuestions) $('#questions').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  view.addEventListener('click', e => {
    if (e.target.closest('[data-more-q]')) { state.q.limit = qLimit() + 15; rerenderKeep(false); return; }
    const sortTh = e.target.closest('[data-sort]');
    if (sortTh) {
      const k = sortTh.dataset.sort;
      state.q.dir = state.q.sort === k ? -state.q.dir : (k === 'ts' ? -1 : 1);
      state.q.sort = k; rerenderKeep(false); return;
    }
    const cpaReset = e.target.closest('[data-cpa-reset]');
    if (cpaReset) { saveCpa(cpaReset.dataset.cpaReset, 0); rerenderKeep(false); return; }
    const del = e.target.closest('[data-hl-del]');
    if (del) { state.hl.splice(+del.dataset.hlDel, 1); saveHl(); rerenderKeep(false); return; }
    if (e.target.closest('[data-hl-clear]')) { state.hl = []; state.q.onlyHl = false; saveHl(); rerenderKeep(false); return; }
    const t = e.target.closest('[data-theme-id],[data-word],[data-goto],[data-clear-q]');
    if (!t) return;
    if (t.dataset.goto) { location.hash = `/event/${encodeURIComponent(t.dataset.goto)}`; return; }
    if (t.dataset.themeId && state.route.sub !== 'questions') {   // từ tab Tổng quan → mở tab Câu hỏi đã lọc
      state.q.theme = t.dataset.themeId; state.q.word = null; state.q.limit = 0; state.pendingQ = true;
      location.hash = routeHash(state.route, 'questions').slice(1);
      return;
    }
    if (t.hasAttribute('data-clear-q')) { state.q.theme = null; state.q.word = null; rerenderKeep(false); return; }
    state.q.limit = 0;
    if (t.dataset.themeId) { state.q.theme = state.q.theme === t.dataset.themeId ? null : t.dataset.themeId; state.q.word = null; }
    if (t.dataset.word) { state.q.word = state.q.word === t.dataset.word ? null : t.dataset.word; state.q.theme = null; }
    rerenderKeep(true);
  });
  view.addEventListener('submit', e => {
    if (!e.target.matches('[data-hl-form]')) return;
    e.preventDefault();
    const words = e.target.hl.value.split(/[,;\n]/).map(w => clean(w).toLowerCase()).filter(w => w.length >= 2);
    for (const w of words) if (!state.hl.includes(w)) state.hl.push(w);
    state.hl = state.hl.slice(0, 12); saveHl();
    rerenderKeep(false);
    const inp = $('[data-hl-form] input'); if (inp) inp.focus({ preventScroll: true });
  });
  view.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); } });
  view.addEventListener('change', e => {
    if (e.target.matches('[data-matrix]')) { state.matrixDim = e.target.value; rerenderKeep(false); }
    if (e.target.matches('[data-pmatrix]')) { state.peopleMatrix = e.target.value; rerenderKeep(false); }
    if (e.target.dataset.cpa) { saveCpa(e.target.dataset.cpa, parseFloat(e.target.value)); rerenderKeep(false); }
    if (e.target.id === 'hideEmpty') { state.q.hideEmpty = e.target.checked; rerenderKeep(false); }
    if (e.target.id === 'onlyHl') { state.q.onlyHl = e.target.checked; rerenderKeep(false); }
    if (e.target.dataset.targetEv) {
      const v = parseInt(e.target.value, 10);
      if (v > 0 && v !== sessionTarget(e.target.dataset.targetEv, e.target.dataset.targetLabel)) saveTarget(e.target.dataset.targetEv, e.target.dataset.targetLabel, v);
      else rerenderKeep(false);
    }
  });
  $('#filters').addEventListener('change', e => {
    if (e.target.dataset.filter) { state.filters[e.target.dataset.filter] = e.target.value; render(true); }
  });
  $('#filters').addEventListener('click', e => {
    if (e.target.closest('[data-reset-filters]')) { state.filters = freshFilters(); render(true); }
  });
  window.addEventListener('hashchange', () => {
    const prev = state.route;
    state.route = readRoute();
    // đổi sự kiện → làm mới bộ lọc; chỉ đổi tab con → giữ nguyên bộ lọc
    if (prev.view !== state.route.view || prev.event !== state.route.event) {
      state.filters = freshFilters(); state.q = { ...state.q, theme: null, word: null, limit: 0 };
    }
    render(false);
    if (state.pendingQ && $('#questions')) $('#questions').scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
    state.pendingQ = false;
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
  setInterval(() => document.querySelectorAll('.s-cd[data-start]').forEach(el => { el.innerHTML = countdownHtml(+el.dataset.start, +el.dataset.end); }), 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.lastFetch && Date.now() - state.lastFetch > 15000) load(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.all.length && render(true));
  window.matchMedia('(max-width: 640px)').addEventListener('change', () => state.all.length && render(true));

  load();
})();
