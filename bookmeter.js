// GET /api/bookmeter?list=wish|read|reading|stacked&page=1
// 読書メーターには公開APIがないため、公開されている本棚のページを1ページずつ読み取る。
// サーバーに負担をかけないよう、1回に1ページだけ取得し、結果は6時間キャッシュする。
const USER = process.env.BOOKMETER_USER_ID || '1435947';
const LISTS = { wish: '読みたい本', read: '読んだ本', reading: '読んでる本', stacked: '積読本' };
const UA = 'MyLibrary/1.0 (personal reading app; https://my-library-seven-alpha.vercel.app)';

const decode = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#([0-9]+);/g, (m, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i')) || tag.match(new RegExp(name + "\\s*=\\s*'([^']*)'", 'i')); return m ? decode(m[1]) : ''; };
const text = (s) => decode(String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));

// 1ページ分の HTML から本を取り出す
export function parse(html) {
  const items = [];
  // 表紙画像を包むリンク（/books/数字）ごとに区切る
  const re = /<a[^>]+href="\/books\/(\d+)"[^>]*>\s*(<img[^>]*>)/gi;
  const hits = [];
  let m;
  while ((m = re.exec(html))) hits.push({ id: m[1], img: m[2], at: m.index });
  hits.forEach((h, i) => {
    if (items.some((x) => x.id === h.id)) return;
    const seg = html.slice(h.at, i + 1 < hits.length ? hits[i + 1].at : h.at + 6000);
    const title = attr(h.img, 'alt') || text((seg.match(/<a[^>]+href="\/books\/\d+"[^>]*>([^<]+)<\/a>/i) || [])[1]);
    let cover = attr(h.img, 'src') || attr(h.img, 'data-src');
    if (/\.gif($|\?)/i.test(cover) || cover.includes('noimage') || cover.includes('no_image')) cover = '';
    const authors = [];
    const ar = /<a[^>]+href="\/search\?author=[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let a;
    while ((a = ar.exec(seg))) { const t = text(a[1]); if (t) authors.push(t); }
    const regs = Number((text(seg).match(/登録\s*([0-9,]+)/) || [])[1]?.replace(/,/g, '') || 0);
    const date = (text(seg).match(/([0-9]{4}\/[0-9]{2}\/[0-9]{2})/) || [])[1] || '';
    if (title) items.push({ id: h.id, title, author: authors.join(','), cover, regs, date, url: 'https://bookmeter.com/books/' + h.id });
  });
  const total = Number((text(html).match(/全\s*([0-9,]+)\s*件/) || [])[1]?.replace(/,/g, '') || items.length);
  let pages = 1;
  const pr = /[?&]page=(\d+)/g;
  let p;
  while ((p = pr.exec(html))) pages = Math.max(pages, Number(p[1]));
  return { total, pages, items };
}

export default async function handler(req, res) {
  const list = LISTS[req.query.list] ? req.query.list : 'wish';
  const page = Math.max(1, Math.min(500, Number(req.query.page) || 1));
  const url = `https://bookmeter.com/users/${USER}/books/${list}` + (page > 1 ? `?page=${page}` : '');
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 9000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'ja' } });
    if (!r.ok) return res.status(502).json({ error: '読書メーター ' + r.status });
    const out = parse(await r.text());
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ user: USER, list, name: LISTS[list], page, ...out });
  } catch (e) {
    return res.status(504).json({ error: String(e.message || e).slice(0, 200) });
  } finally { clearTimeout(t); }
}
