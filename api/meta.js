// GET /api/meta?kind=paper|magazine&q=<URL か DOI> — 登録前に題名・著者・年・表紙などを調べる
import { metas, first, decode, fetchPage, fetchJson, fetchText, publicUrl } from './_html.js';

const tidy = (s) => Array.from(decode(s)).map((c) => (c.trim() === '' ? ' ' : c)).join('').split(' ').filter(Boolean).join(' ');
function findDoi(s) {
  const x = String(s || '');
  const k = x.indexOf('10.');
  if (k < 0) return '';
  let d = '';
  try { d = decodeURIComponent(x.slice(k)); } catch (e) { d = x.slice(k); }
  d = d.split(' ')[0].split('?')[0].split('#')[0];
  while (d && '.,;)]'.includes(d[d.length - 1])) d = d.slice(0, -1);
  const slash = d.indexOf('/');
  return slash > 3 && /^10[.][0-9]{4,9}[/]/.test(d) ? d : '';
}
function arxivId(u) {
  const x = publicUrl(u);
  if (!x || !x.hostname.endsWith('arxiv.org')) return '';
  const p = x.pathname.split('/').filter(Boolean);
  const k = p.findIndex((s) => s === 'abs' || s === 'pdf' || s === 'html');
  if (k < 0 || !p[k + 1]) return '';
  return p.slice(k + 1).join('/').replace(/[.]pdf$/, '').replace(/v[0-9]+$/, '');
}
const between = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i + a.length); return j < 0 ? '' : s.slice(i + a.length, j); };

async function crossref(doi) {
  const j = await fetchJson('https://api.crossref.org/works/' + encodeURIComponent(doi));
  const m = j && j.message;
  if (!m) return null;
  const pdf = (m.link || []).find((l) => (l['content-type'] || '').includes('pdf'));
  const year = ((m.issued || m.published || {})['date-parts'] || [[0]])[0][0] || 0;
  return {
    title: tidy((m.title || [''])[0]),
    authors: (m.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name || '').filter(Boolean).slice(0, 12).join(', '),
    year, journal: tidy((m['container-title'] || [''])[0]), doi, url: m.URL || 'https://doi.org/' + doi, pdf: pdf ? pdf.URL : '',
  };
}
async function arxiv(id) {
  const x = await fetchText('https://export.arxiv.org/api/query?id_list=' + encodeURIComponent(id));
  const entry = between(x, '<entry>', '</entry>');
  if (!entry) return null;
  const names = entry.split('<name>').slice(1).map((s) => tidy(s.split('</name>')[0]));
  const pub = between(entry, '<published>', '</published>');
  const doi = between(entry, '<arxiv:doi', '</arxiv:doi>').split('>').pop();
  return { title: tidy(between(entry, '<title>', '</title>')), authors: names.slice(0, 12).join(', '), year: Number(pub.slice(0, 4)) || 0, journal: 'arXiv', doi: doi || '', url: 'https://arxiv.org/abs/' + id, pdf: 'https://arxiv.org/pdf/' + id };
}
function absolute(u, base) { try { return new URL(u, base).href; } catch (e) { return ''; } }

async function paper(q) {
  const doi = findDoi(q);
  const isUrl = q.startsWith('http');
  const ax = isUrl ? arxivId(q) : '';
  if (ax) { const a = await arxiv(ax); if (a) return a; }
  if (doi && (!isUrl || q.includes('doi.org/'))) { const c = await crossref(doi); if (c) return c; }
  if (!isUrl) return null;
  const page = await fetchPage(q);
  if (!page) return { title: '', url: q };
  const lowUrl = page.url.toLowerCase();
  if (page.type.includes('pdf') || lowUrl.split('?')[0].endsWith('.pdf')) {
    const name = decodeURIComponent(page.url.split('?')[0].split('/').pop() || '').replace(/[.]pdf$/i, '').split('_').join(' ');
    const c = doi ? await crossref(doi) : null;
    return c ? { ...c, pdf: page.url, url: c.url } : { title: name, url: q, pdf: page.url };
  }
  const m = metas(page.text);
  const out = {
    title: tidy(first(m, 'citation_title', 'dc.title', 'og:title', 'twitter:title', '<title>')),
    authors: (m.citation_author || m['dc.creator'] || []).map(tidy).slice(0, 12).join(', ') || tidy(first(m, 'author')),
    year: Number(first(m, 'citation_publication_date', 'citation_date', 'citation_year', 'citation_online_date', 'dc.date', 'article:published_time').slice(0, 4)) || 0,
    journal: tidy(first(m, 'citation_journal_title', 'citation_conference_title', 'citation_publisher', 'og:site_name')),
    doi: first(m, 'citation_doi', 'dc.identifier') ? findDoi(first(m, 'citation_doi', 'dc.identifier')) : doi,
    url: page.url || q,
    pdf: absolute(first(m, 'citation_pdf_url'), page.url),
  };
  if (out.doi && (!out.title || !out.authors || !out.year)) {
    const c = await crossref(out.doi);
    if (c) return { ...c, url: out.url, pdf: out.pdf || c.pdf };
  }
  return out;
}
async function magazine(q) {
  const page = await fetchPage(q);
  if (!page || !page.text) return { title: '', url: q };
  const m = metas(page.text);
  const site = tidy(first(m, 'og:site_name', 'application-name')).replace(/^@/, '');
  let title = tidy(first(m, 'og:title', 'twitter:title', '<title>'));
  if (site && title.endsWith(site) && title.length > site.length + 3) title = title.slice(0, title.length - site.length).replace(/[ |｜:：–—-]+$/, '').trim();
  return {
    title,
    magazine: site,
    cover: absolute(first(m, 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'), page.url),
    date: first(m, 'article:published_time', 'og:article:published_time', 'date', 'pubdate', 'dc.date', 'og:updated_time').slice(0, 10),
    url: page.url || q,
  };
}

export default async function handler(req, res) {
  const kind = String(req.query.kind || 'paper');
  const q = String(req.query.q || '').trim().slice(0, 1500);
  if (!q) return res.status(400).json({ error: 'URL か DOI を入れてください' });
  try {
    const out = kind === 'magazine' ? await magazine(q) : await paper(q);
    if (!out) return res.status(404).json({ error: '見つかりませんでした' });
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(200).json(out);
  } catch (e) { return res.status(200).json({ title: '', url: q, error: String(e.message || e).slice(0, 200) }); }
}
