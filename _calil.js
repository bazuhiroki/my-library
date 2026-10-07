// /api/calil（vercel.json の rewrites で /api/meter-notion?mode=calil に回す）— カーリルで葛飾区立図書館の蔵書と貸出状況を調べる
// CALIL_APPKEY（カーリルのアプリキー）が無いときは { available:false } を返す。
// 葛飾区立図書館のカーリル上の ID。決め打ちせず、最初にカーリルの図書館一覧から見つけて覚えておく
let SYSTEM = process.env.CALIL_SYSTEMID || '';
async function systemId(key) {
  if (SYSTEM) return SYSTEM;
  try {
    const r = await fetch(`https://api.calil.jp/library?appkey=${encodeURIComponent(key)}&pref=${encodeURIComponent('東京都')}&city=${encodeURIComponent('葛飾区')}&format=json&callback=`);
    const t = (await r.text()).trim();
    const a = t.indexOf('['), b = t.lastIndexOf(']');
    const libs = JSON.parse(t.slice(a, b + 1));
    const hit = libs.find((l) => String(l.systemid || '').includes('Katsushika')) || libs.find((l) => String(l.systemname || '').includes('葛飾区')) || libs[0];
    SYSTEM = (hit && hit.systemid) || 'Tokyo_Katsushika';
  } catch (e) { SYSTEM = 'Tokyo_Katsushika'; }
  return SYSTEM;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 図書館ごとの状態から、ひとことの状態にまとめる
function summarize(sys) {
  if (!sys) return { status: '不明' };
  if (sys.status === 'Error') return { status: '不明' };
  const libs = sys.libkey || {};
  const vals = Object.values(libs);
  let status = '蔵書なし';
  if (vals.includes('貸出可')) status = '貸出可';
  else if (vals.length) status = vals.find((v) => v !== '蔵書なし') || vals[0];
  return { status, reserveurl: sys.reserveurl || '', libs };
}

export async function calil(req, res) {
  if (req.query.find) return findIsbn(req, res);
  const key = process.env.CALIL_APPKEY;
  if (!key) return res.status(200).json({ available: false });
  const isbns = String(req.query.isbn || '').split(',').map((s) => s.replace(/[^0-9X]/gi, '')).filter((s) => s.length === 10 || s.length === 13).slice(0, 30);
  if (!isbns.length) return res.status(200).json({ available: true, books: {} });
  try {
    const sys = await systemId(key);
    let url = `https://api.calil.jp/check?appkey=${encodeURIComponent(key)}&isbn=${isbns.join(',')}&systemid=${encodeURIComponent(sys)}&format=json&callback=no`;
    let j = null;
    // カーリルは結果がそろうまで「continue」を返すので、数回だけ待って問い合わせ直す
    for (let i = 0; i < 6; i++) {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      j = await r.json();
      if (!j.continue) break;
      await sleep(1200);
      url = `https://api.calil.jp/check?appkey=${encodeURIComponent(key)}&session=${encodeURIComponent(j.session)}&format=json&callback=no`;
    }
    const books = {};
    isbns.forEach((n) => { books[n] = summarize(j && j.books && j.books[n] && j.books[n][sys]); });
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(200).json({ available: true, system: sys, books, pending: !!(j && j.continue) });
  } catch (e) {
    return res.status(200).json({ available: true, books: {}, error: String(e.message || e).slice(0, 120) });
  }
}

// 題名と著者から ISBN を探す（国立国会図書館サーチ。キー不要で日本の本に強い）
// GET /api/calil?find=1&title=&author=  →  { isbn }
const nfk = (x) => String(x || '').normalize('NFKC').toLowerCase().replace(/[\s・「」『』()（）:：、。!！?？.,－―─\-]/g, '');
const unxml = (x) => String(x || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, "'").trim();
export async function findIsbn(req, res) {
  const title = String(req.query.title || '').split(/[－―(（]/)[0].trim().slice(0, 120);
  const author = String(req.query.author || '').split(/[,、・\s]/).filter(Boolean)[0] || '';
  if (!title) return res.status(400).json({ isbn: '' });
  const ask = async (withAuthor) => {
    const u = 'https://ndlsearch.ndl.go.jp/api/opensearch?cnt=20&title=' + encodeURIComponent(title) + (withAuthor && author ? '&creator=' + encodeURIComponent(author) : '');
    const r = await fetch(u, { headers: { Accept: 'application/rss+xml, application/xml' } });
    if (!r.ok) return [];
    const xml = await r.text();
    return xml.split('<item>').slice(1).map((it) => {
      const t = unxml((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      const who = (it.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/g) || []).map((x) => unxml(x.replace(/<[^>]+>/g, ''))).join(' ');
      const ids = (it.match(/<dc:identifier[^>]*ISBN[^>]*>([^<]+)<\/dc:identifier>/g) || []).map((x) => x.replace(/<[^>]+>/g, '').replace(/[^0-9Xx]/g, '')).filter((n) => n.length === 13 || n.length === 10);
      return { t, who, isbn: ids.find((n) => n.length === 13) || ids[0] || '' };
    }).filter((x) => x.isbn);
  };
  try {
    const want = nfk(title), a = nfk(author);
    let list = await ask(true);
    if (!list.length) list = await ask(false);
    // 題名が合うものを優先し、著者も合えばさらに優先。新しい版（文庫など）でも図書館の蔵書確認には使える
    const scored = list.map((x) => {
      const t = nfk(x.t);
      let s = t === want ? 6 : t.startsWith(want) ? 4 : t.includes(want) ? 2 : 0;
      if (s && a && nfk(x.who).includes(a)) s += 3;
      return [s, x];
    }).filter(([s]) => s > 0).sort((p, q) => q[0] - p[0]);
    const isbn = scored.length ? scored[0][1].isbn : '';
    res.setHeader('Cache-Control', 's-maxage=2592000');
    return res.status(200).json({ isbn, found: scored.length });
  } catch (e) {
    return res.status(200).json({ isbn: '', error: String(e.message || e).slice(0, 120) });
  }
}
