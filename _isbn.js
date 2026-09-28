// ISBN の正規化と書誌の取得（openBD → Google Books → 国立国会図書館サーチ の順）
const digits = (s) => (s || '').toString().replace(/[^0-9Xx]/g, '').toUpperCase();
const ok13 = (d) => { let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * (i % 2 ? 3 : 1); return (10 - (s % 10)) % 10 === +d[12]; };
const ok10 = (d) => { let s = 0; for (let i = 0; i < 10; i++) s += (d[i] === 'X' ? 10 : +d[i]) * (10 - i); return s % 11 === 0; };
function to13(d10) { const b = '978' + d10.slice(0, 9); let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return b + ((10 - (s % 10)) % 10); }
export function normIsbn(v) {
  const d = digits(v);
  if (d.length === 13 && /^97[89]/.test(d) && ok13(d)) return d;
  if (d.length === 10 && ok10(d)) return to13(d);
  return null;
}

async function get(url, ms = 4500) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'my-library/1.0 (personal reading app)' } }); return r.ok ? r : null; }
  catch (_) { return null; } finally { clearTimeout(t); }
}
const splitAuthors = (s) => (s || '').split(/[,，、;；\/／]| {2,}|　/).map((a) => a.replace(/\[?(著|作|訳|編|編著|監修|絵|文|原作|著者|作者)\]?$/g, '').replace(/^(著|作)[:：]/, '').trim()).filter((a) => a && !/^(著|訳|編|絵)$/.test(a));
const unescape = (s) => (s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export async function lookup(isbn) {
  const info = { isbn, title: '', authors: [], publisher: '', description: '', cover: '' };
  const r1 = await get(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
  if (r1) {
    try {
      const a = await r1.json(); const s = a && a[0] && a[0].summary;
      if (s && s.title) {
        info.title = s.title; info.authors = splitAuthors(s.author); info.publisher = s.publisher || ''; info.cover = s.cover || '';
        const tc = a[0].onix?.CollateralDetail?.TextContent || [];
        info.description = (tc.find((x) => x.TextType === '03') || tc.find((x) => x.TextType === '02') || {}).Text || '';
      }
    } catch (_) {}
  }
  if (!info.title || !info.description || !info.cover) {
    const r2 = await get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
    if (r2) {
      try {
        const v = (await r2.json()).items?.[0]?.volumeInfo;
        if (v) {
          if (!info.title) { info.title = [v.title, v.subtitle].filter(Boolean).join(' '); info.authors = v.authors || []; info.publisher = v.publisher || ''; }
          if (!info.description) info.description = v.description || '';
          if (!info.cover && v.imageLinks) info.cover = (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail || '').replace('http://', 'https://');
        }
      } catch (_) {}
    }
  }
  if (!info.title) {
    const r3 = await get(`https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}&cnt=1`);
    if (r3) {
      const x = await r3.text(); const item = (x.match(/<item>([\s\S]*?)<\/item>/) || [])[1] || '';
      const tag = (n) => unescape(((item.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)) || [])[1] || '').trim());
      info.title = tag('title') || tag('dc:title');
      info.authors = splitAuthors(tag('author') || tag('dc:creator'));
      info.publisher = tag('dc:publisher');
    }
  }
  return info.title ? info : null;
}

// 表紙画像の候補（先に見つかったものを使う）
export const coverCandidates = (isbn, known) => [
  `https://cover.openbd.jp/${isbn}.jpg`,
  `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg`,
  known,
].filter(Boolean);
export { get, splitAuthors };
