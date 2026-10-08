// /api/library（vercel.json の rewrites で /api/meter-notion?mode=library に回す）
// 葛飾区立図書館の「利用者メニュー」にログインして、貸出中・予約中の本を読み取る。
// ID とパスワードは Vercel の環境変数（KATSUSHIKA_LIB_ID / KATSUSHIKA_LIB_PASS）にだけ置き、画面には出さない。
// ?debug=1 を付けると、ページの作り（フォーム・リンク・表の見出し）を返す（直すときの手がかり）。
const BASE = 'https://www.lib.city.katsushika.lg.jp/';
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';

const decode = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#([0-9]+);/g, (m, d) => String.fromCodePoint(Number(d)))
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, "'").replace(/&amp;/g, '&');
const text = (h) => decode(String(h || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", 'i')); return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : ''; };

// クッキーを覚えながら、転送も自分でたどる小さなブラウザ
function browser() {
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
  function keep(r) {
    const list = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')] : []);
    list.forEach((c) => { const [kv] = c.split(';'); const i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); });
  }
  async function go(url, opt = {}) {
    let u = new URL(url, BASE).href, method = opt.method || 'GET', body = opt.body;
    for (let hop = 0; hop < 8; hop++) {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
      let r;
      try {
        r = await fetch(u, { method, body, redirect: 'manual', signal: c.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'ja', Accept: 'text/html,application/xhtml+xml', Cookie: cookieHeader(), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), Referer: opt.referer || BASE } });
      } finally { clearTimeout(t); }
      keep(r);
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = new URL(r.headers.get('location'), u).href; method = 'GET'; body = undefined; continue; }
      return { url: u, status: r.status, html: await r.text() };
    }
    throw new Error('転送が多すぎます');
  }
  return { go };
}

// ページの中のフォームとリンク
function forms(html, pageUrl) {
  const out = [];
  const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = re.exec(html))) {
    const inputs = [];
    const ir = /<(input|button|select)\b([^>]*)>/gi;
    let i;
    while ((i = ir.exec(m[2]))) inputs.push({ tag: i[1].toLowerCase(), type: (attr(i[2], 'type') || (i[1].toLowerCase() === 'button' ? 'submit' : 'text')).toLowerCase(), name: attr(i[2], 'name'), value: attr(i[2], 'value'), id: attr(i[2], 'id') });
    out.push({ action: new URL(attr(m[1], 'action') || pageUrl, pageUrl).href, method: (attr(m[1], 'method') || 'get').toLowerCase(), inputs });
  }
  return out;
}
function links(html, pageUrl) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) { const href = attr(m[1], 'href'); if (href && !href.startsWith('javascript') && !href.startsWith('#')) out.push({ text: text(m[2]), href: new URL(href, pageUrl).href }); }
  return out;
}
// 表を「見出し → 値」の行にする
function tables(html) {
  const out = [];
  const re = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = re.exec(html))) {
    const rows = [];
    const rr = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let r;
    while ((r = rr.exec(m[1]))) {
      const cells = [];
      const cr = /<(t[hd])\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let c;
      while ((c = cr.exec(r[1]))) cells.push({ th: c[1].toLowerCase() === 'th', v: text(c[2]) });
      if (cells.length) rows.push(cells);
    }
    if (!rows.length) continue;
    const head = rows[0].every((c) => c.th) ? rows[0].map((c) => c.v) : null;
    const body = (head ? rows.slice(1) : rows).map((cells) => (head ? Object.fromEntries(cells.map((c, k) => [head[k] || 'col' + k, c.v])) : cells.map((c) => c.v)));
    out.push({ head, rows: body });
  }
  return out;
}
// 表の行から、題名・期限などを拾う
function pick(row) {
  const get = (...keys) => { if (Array.isArray(row)) return ''; const k = Object.keys(row).find((h) => keys.some((x) => h.includes(x))); return k ? row[k] : ''; };
  const title = get('タイトル', '書名', '資料名', '題名') || (Array.isArray(row) ? row.find((v) => v.length > 3) || '' : '');
  return {
    title, author: get('著者'), due: get('返却期限', '返却予定', '期限'), date: get('貸出日', '予約日'),
    status: get('状態', '状況', 'ステータス'), place: get('受取', '館'), rank: get('順位', '順番'), until: get('取置', '受取期限', '取り置き'),
    raw: row,
  };
}

// 表になっていない一覧（「1 題名 貸出場所 … 返却期限 …」が並ぶ形）を、文字の並びから読み取る
const D = '(\\d{4}年\\d{1,2}月\\d{1,2}日)';
function listBody(t) {
  const a = t.indexOf('印刷');
  const b = t.indexOf('マイライブラリメニューに戻る', a);
  const c = t.indexOf('受取希望館に', a);
  const end = [b, c].filter((x) => x > a).sort((x, y) => x - y)[0];
  return a < 0 ? '' : t.slice(a + 2, end > a ? end : undefined);
}
function parseLoans(t) {
  const out = [];
  const re = new RegExp('(?:^|\\s)(\\d+)\\s+(.+?)\\s+貸出場所\\s+(\\S+)\\s+貸出日\\s+' + D + '(?:\\s+延長\\s+(\\S+))?\\s+返却期限\\s+' + D, 'g');
  let m;
  while ((m = re.exec(listBody(t)))) out.push({ title: m[2], place: m[3], date: m[4], renew: m[5] || '', due: m[6], status: '' });
  return out;
}
function parseReserves(t) {
  const out = [];
  const re = new RegExp('(?:^|\\s)(\\d+)\\s+(.+?)\\s+受取場所\\s+(\\S+)\\s+予約日\\s+' + D + '\\s+予約状況\\s+(\\S+)(?:\\s+取置期限\\s+' + D + ')?(?:\\s+所蔵数\\s+(\\d+))?(?:\\s+順位\\s+(\\d+))?', 'g');
  let m;
  while ((m = re.exec(listBody(t)))) out.push({ title: m[2], place: m[3], date: m[4], status: m[5], until: m[6] || '', copies: m[7] || '', rank: m[8] || '' });
  return out;
}

export async function library(req, res) {
  const id = process.env.KATSUSHIKA_LIB_ID, pw = process.env.KATSUSHIKA_LIB_PASS;
  if (!id || !pw) return res.status(200).json({ available: false, error: 'ID とパスワードが未設定です' });
  const debug = !!req.query.debug;
  const b = browser();
  const trace = [];
  try {
    // 1. 利用者メニューを開く（ログインしていなければログイン画面になる）
    let page = await b.go('idcheck');
    trace.push({ step: '利用者メニュー', url: page.url.replace(/;jsessionid=[^?]*/, ''), status: page.status });
    let fs = forms(page.html, page.url);
    let lf = fs.find((f) => f.inputs.some((i) => i.type === 'password'));
    if (!lf) {
      const login = links(page.html, page.url).find((l) => l.text.includes('ログイン'));
      if (login) { page = await b.go(login.href); fs = forms(page.html, page.url); lf = fs.find((f) => f.inputs.some((i) => i.type === 'password')); trace.push({ step: 'ログイン画面', url: page.url.replace(/;jsessionid=[^?]*/, ''), status: page.status }); }
    }
    // 2. ログインする
    if (lf) {
      const params = new URLSearchParams();
      const user = lf.inputs.find((i) => ['text', 'tel', 'number', 'email'].includes(i.type) && i.name);
      const pass = lf.inputs.find((i) => i.type === 'password');
      lf.inputs.forEach((i) => {
        if (!i.name) return;
        if (i === user) params.set(i.name, id);
        else if (i === pass) params.set(i.name, pw);
        else if (i.type === 'hidden') params.set(i.name, i.value);
        else if (i.type === 'checkbox' || i.type === 'radio') { /* 付けない */ }
      });
      const submit = lf.inputs.find((i) => (i.type === 'submit' || i.type === 'image') && i.name);
      if (submit) params.set(submit.name, submit.value || 'ログイン');
      page = await b.go(lf.action, { method: lf.method === 'get' ? 'GET' : 'POST', body: params.toString(), referer: page.url });
      trace.push({ step: 'ログイン送信', url: page.url.replace(/;jsessionid=[^?]*/, ''), status: page.status, fields: lf.inputs.map((i) => i.type + ':' + (i.name || '-')) });
    }
    const loggedIn = /ログアウト/.test(text(page.html)) && !forms(page.html, page.url).some((f) => f.inputs.some((i) => i.type === 'password'));
    if (!loggedIn) {
      const msg = (text(page.html).match(/(利用者ID|パスワード)[^。]{0,40}(誤|違|正しく)[^。]*。?/) || [])[0] || '';
      return res.status(200).json({ available: true, ok: false, error: 'ログインできませんでした' + (msg ? '（' + msg + '）' : ''), ...(debug ? { trace, forms: forms(page.html, page.url).map((f) => ({ action: f.action.replace(/;jsessionid=[^?]*/, ''), inputs: f.inputs.map((i) => i.type + ':' + (i.name || '-')) })), pageText: text(page.html).slice(0, 1500) } : {}) });
    }
    // 3. 貸出状況・予約状況のページを探して読む
    const menu = links(page.html, page.url);
    const find = (...words) => menu.find((l) => words.some((w) => l.text.includes(w)));
    const out = { available: true, ok: true, loans: [], reserves: [], at: new Date().toISOString() };
    const read = async (link, kind) => {
      if (!link) return;
      const p = await b.go(link.href, { referer: page.url });
      const tb = tables(p.html);
      trace.push({ step: kind, link: link.text, url: p.url.replace(/;jsessionid=[^?]*/, ''), status: p.status, tables: tb.map((t) => ({ head: t.head, rows: t.rows.length })) });
      const plain = text(p.html);
      // まず文字の並びから読む（この図書館の一覧は表ではない）。読めなければ表から読む
      let list = kind === '貸出' ? parseLoans(plain) : parseReserves(plain);
      if (!list.length) {
        const best = tb.filter((t) => t.rows.length > 1).sort((x, y) => y.rows.length - x.rows.length)[0];
        list = best ? best.rows.map(pick).filter((x) => x.title) : [];
      }
      out[kind === '貸出' ? 'loans' : 'reserves'] = list;
      if (debug) out[kind === '貸出' ? 'loanText' : 'reserveText'] = text(p.html).slice(0, 2500);
    };
    await read(find('貸出状況', '貸出中', '借りている', '貸出一覧'), '貸出');
    await read(find('予約状況', '予約中', '予約一覧', '予約の確認'), '予約');
    if (debug) { out.trace = trace; out.menu = menu.filter((l) => l.href.startsWith(BASE)).map((l) => l.text).filter(Boolean).slice(0, 60); }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ available: true, ok: false, error: String(e.message || e).slice(0, 160), ...(debug ? { trace } : {}) });
  }
}
