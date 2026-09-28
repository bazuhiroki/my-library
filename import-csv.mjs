// 葛飾区立図書館の貸出履歴CSV（RENTHIS*.csv）を src/data/read-books.json に変換する
// 使い方: npm run import-csv -- path/to/RENTHIS20260927.csv
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('CSVのパスを指定してください: npm run import-csv -- RENTHIS.csv'); process.exit(1); }

const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
function parseCSV(src) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const rows = parseCSV(text);
const h = rows.findIndex((r) => r.includes('タイトル'));
if (h < 0) { console.error('「タイトル」列が見つかりません'); process.exit(1); }
const head = rows[h], ti = head.indexOf('タイトル'), ai = head.indexOf('著者名'), di = head.indexOf('貸出日');
const seen = new Set(), out = [];
for (const r of rows.slice(h + 1)) {
  const t = (r[ti] || '').trim(); if (!t || seen.has(t)) continue; seen.add(t);
  const a = (r[ai] || '').split('　')[0].replace(/／.*/, '').trim();
  out.push([t, a, (r[di] || '').trim()]);
}
writeFileSync(new URL('./read-books.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length}冊を src/data/read-books.json に書き出しました`);
