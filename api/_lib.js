// サーバー側の共通処理：Notion「小説作成賞」DBの読み書きと、芥川賞・直木賞の公式発表の読み取り
const NOTION = 'https://api.notion.com/v1';
export const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID || '104f2cdb-bcbc-4003-8433-b9c939774209';
export const DATABASE_ID = process.env.NOTION_DATABASE_ID || 'f57634549b044e9b8210fecee287b8e8';

const headers = (version) => ({
  Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': version,
  'Content-Type': 'application/json',
});
const text = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('').trim();

// 空白（改行・タブ・全角空白を含む）を扱う小さな道具
const sp = (s) => Array.from(String(s || '')).map((c) => (c.trim() === '' ? ' ' : c)).join('');
const nows = (s) => Array.from(String(s || '')).filter((c) => c.trim() !== '').join('');
const squash = (s) => sp(s).split(' ').filter(Boolean).join(' ');

export function parseRound(prize, s) {
  const t = sp(s);
  const n = +((t.match(/第 *([0-9]+) *回/) || t.match(/([0-9]+) *回/) || t.match(/([0-9]+)/) || [])[1]) || 0;
  let y = +((t.match(/(1[89][0-9]{2}|20[0-9]{2})年/) || [])[1]) || null;
  const era = t.match(/(昭和|平成|令和)(元|[0-9]+)年/);
  if (!y && era) y = { 昭和: 1925, 平成: 1988, 令和: 2018 }[era[1]] + (era[2] === '元' ? 1 : +era[2]);
  const half = t.includes('上半期') ? '上' : t.includes('下半期') ? '下' : '';
  const label = half && y ? `第${n}回（${y}年${half}半期）` : `第${n}回` + (y ? `（${y}年）` : '');
  return { n, y, label };
}

// Notion の行を [書名, 著者, 賞, 回, 年, 表示ラベル, 読了] に揃えて返す
export async function readNotion() {
  if (!process.env.NOTION_TOKEN) return null;
  const rows = [];
  let cursor;
  let mode = 'ds';
  for (let page = 0; page < 30; page++) {
    const body = JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    let r = mode === 'ds'
      ? await fetch(`${NOTION}/data_sources/${DATA_SOURCE_ID}/query`, { method: 'POST', headers: headers('2025-09-03'), body })
      : await fetch(`${NOTION}/databases/${DATABASE_ID}/query`, { method: 'POST', headers: headers('2022-06-28'), body });
    if (!r.ok && mode === 'ds' && page === 0) { mode = 'db'; page--; continue; }
    if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
    const j = await r.json();
    for (const pg of j.results) {
      const p = pg.properties || {};
      const t = text(p['小説タイトル']).replace(/^「|」$/g, '');
      const prize = p['賞タイトル']?.select?.name;
      if (!t || !prize || /^該当|^受賞作なし/.test(t)) continue;
      const a = nows(text(p['作者']));
      const { n, y, label } = parseRound(prize, text(p['何回']));
      rows.push([t, a === '-' ? '' : a, prize, n, y, label, p['読了']?.checkbox ? 1 : 0]);
    }
    if (!j.has_more) break;
    cursor = j.next_cursor;
  }
  return rows;
}

// 日本文学振興会の最新情報ページから、最新回の受賞作を読む
const OFFICIAL = { 芥川賞: 'https://bungakushinko.or.jp/award/akutagawa/index.html', 直木賞: 'https://bungakushinko.or.jp/award/naoki/index.html' };
const strip = (h) => squash(h.replace(/<br[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'));
export async function readOfficialLatest() {
  const out = [];
  for (const [prize, url] of Object.entries(OFFICIAL)) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'my-library/1.0' } });
      if (!r.ok) continue;
      const html = await r.text();
      const flat = sp(html);
      const word = prize === '芥川賞' ? '芥川' : '直木';
      const head = flat.match(new RegExp('第 *([0-9]+) *回[^<（(]*?' + word + '.{0,120}?[（(] *([0-9]{4}) *年 *(上|下) *半期'));
      if (!head) continue;
      const n = +head[1], y = +head[2], half = head[3];
      if (/該当作(品)?なし/.test(strip(html).slice(0, 4000))) continue;
      for (const chunk of flat.split(/<tr[^>]*>/i).slice(1)) {
        const rowHtml = chunk.split(/<[/]tr>/i)[0];
        const cells = rowHtml.split(/<t[dh][^>]*>/i).slice(1).map((c) => strip(c.split(/<[/]t[dh]>/i)[0]));
        if (cells.length < 2 || !/受賞/.test(cells[0])) continue;
        const author = nows(cells[0].replace(/[（(][^）)]*[）)]/g, '').replace(/受賞/g, ''));
        const title = cells[1].replace(/^[「『]|[」』]$/g, '').replace(/[（(][^）)]*[）)]$/, '').trim();
        if (title && author) out.push([title, author, prize, n, y, `第${n}回（${y}年${half}半期）`, 0]);
      }
    } catch (_) { /* 取れなかった賞は飛ばす */ }
  }
  return out;
}

// Notion に行を1つ追加（「何回」は既存の書き方 175回(2026年上半期) に合わせる）
export async function addToNotion([t, a, prize, n, y, label]) {
  const half = (label.match(/(上|下)半期/) || [])[1];
  const kai = half ? `${n}回(${y}年${half}半期)` : label;
  const props = {
    小説タイトル: { title: [{ text: { content: t } }] },
    作者: { rich_text: [{ text: { content: a } }] },
    何回: { rich_text: [{ text: { content: kai } }] },
    賞タイトル: { select: { name: prize } },
    読了: { checkbox: false },
  };
  let r = await fetch(`${NOTION}/pages`, { method: 'POST', headers: headers('2025-09-03'), body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: DATA_SOURCE_ID }, properties: props }) });
  if (!r.ok) r = await fetch(`${NOTION}/pages`, { method: 'POST', headers: headers('2022-06-28'), body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties: props }) });
  if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
}

const key = (t) => nows(String(t || '').normalize('NFKC')).replace(/[「」『』・]/g, '').toLowerCase();
export function missing(latest, rows) {
  const have = new Set(rows.map((r) => r[2] + '|' + key(r[0])));
  return latest.filter((r) => !have.has(r[2] + '|' + key(r[0])));
}
