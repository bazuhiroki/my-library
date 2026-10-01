// GET /api/bookinfo?title=&author=&isbn= — 本を取り出したときの紹介（表紙・内容紹介・出版社・発行年・ページ数）
// Google Books で本を特定し、ISBN が分かれば openBD の内容紹介と表紙で補う
import { normIsbn, lookup, get } from './_isbn.js';

const KEY = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}` : '';
const nows = (s) => Array.from(String(s || '')).filter((c) => c.trim() !== '').join('');
const norm = (s) => nows(String(s || '').normalize('NFKC').toLowerCase()).replace(/[・「」『』()（）:：、。!！?？.,－―─-]/g, '');
const mainTitle = (t) => (t || '').split(/[－―]/)[0].replace(/[（(][^）)]*[）)]/g, '').replace(/^[「『]|[」』]$/g, '').trim();
const isbnOf = (v) => { const ids = v.industryIdentifiers || []; const x = ids.find((i) => i.type === 'ISBN_13') || ids.find((i) => i.type === 'ISBN_10'); return x ? normIsbn(x.identifier) : null; };
const thumb = (v) => { const l = v.imageLinks || {}; const u = l.large || l.medium || l.thumbnail || l.smallThumbnail || ''; return u.replace('http://', 'https://').replace('&edge=curl', ''); };

async function google(q) {
  const r = await get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books${KEY}`, 5000);
  if (!r) return [];
  try { return ((await r.json()).items || []).map((i) => ({ id: i.id, ...i.volumeInfo })); } catch (_) { return []; }
}
function score(v, title, author) {
  const t = norm(mainTitle(title)), vt = norm(v.title);
  let s = 0;
  if (vt === t) s += 6; else if (vt.startsWith(t) || t.startsWith(vt)) s += 4; else if (vt.includes(t) || t.includes(vt)) s += 2; else return -1;
  const a = norm(author);
  if (a && (v.authors || []).some((x) => norm(x).includes(a) || a.includes(norm(x)))) s += 4;
  if (v.language === 'ja') s += 1;
  if (v.description) s += 1;
  if (v.imageLinks) s += 1;
  if (isbnOf(v)) s += 1;
  return s;
}

export default async function handler(req, res) {
  const title = String(req.query.title || '').slice(0, 200);
  const author = nows(req.query.author).slice(0, 100);
  let isbn = normIsbn(req.query.isbn);
  if (!title && !isbn) return res.status(400).json({ error: '書名かISBNが必要です' });

  let best = null;
  if (isbn) {
    const vs = await google(`isbn:${isbn}`);
    best = vs[0] || null;
  }
  if (!best && title) {
    const mt = mainTitle(title);
    let vs = await google(`intitle:${mt}${author ? ` inauthor:${author}` : ''}`);
    if (!vs.length && author) vs = await google(`${mt} ${author}`);
    if (!vs.length) vs = await google(`intitle:${mt}`);
    const ranked = vs.map((v) => [score(v, title, author), v]).filter(([s]) => s >= 2).sort((a, b) => b[0] - a[0]);
    best = ranked.length ? ranked[0][1] : null;
  }
  if (best && !isbn) isbn = isbnOf(best);

  const out = {
    title: best ? [best.title, best.subtitle].filter(Boolean).join(' ') : title,
    authors: best?.authors || (author ? [author] : []),
    publisher: best?.publisher || '',
    publishedDate: best?.publishedDate || '',
    pageCount: best?.pageCount || 0,
    categories: best?.categories || [],
    description: best?.description || '',
    cover: best ? thumb(best) : '',
    infoLink: best?.infoLink || '',
    isbn: isbn || '',
    source: best ? 'google' : '',
  };
  // openBD（出版社の内容紹介）で補う。日本の本はこちらの方が詳しいことが多い
  if (isbn) {
    const o = await lookup(isbn);
    if (o) {
      if (o.description && o.description.length > (out.description || '').length * 0.6) out.description = o.description;
      if (!out.publisher) out.publisher = o.publisher;
      if (!out.cover && o.cover) out.cover = o.cover;
      if (!best) { out.title = o.title; out.authors = o.authors; out.source = 'openbd'; }
    }
  }
  if (!out.source && !out.description) {
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(404).json({ error: '紹介が見つかりませんでした', ...out });
  }
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=604800');
  res.status(200).json(out);
}
