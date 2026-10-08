// 毎日1回（vercel.json の crons）：読書メーターの4つの本棚の先頭ページを読んで、
// 新しい本は Notion「読書メーター」に追加し、本棚が変わった本（読みたい→読んだ など）は更新する。
// 最初の取り込み（1759冊ぶん）はアプリの「Notionに同期」ボタンから行う。
// ジャンルとタグは Notion 側の AI エージェントが付け、アプリはそれを読み込んで表示する。
import { parse } from './bookmeter.js';
import { queryPage, createPage, patchPage, fromPage, SHELF, sleep } from './_meter.js';
import { ingestLatest } from './_movies.js';
import { factoryMorning } from './_factory.js';

const USER = process.env.BOOKMETER_USER_ID || '1435947';
const UA = 'MyLibrary/1.0 (personal reading app; https://my-library-seven-alpha.vercel.app)';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  if (!process.env.NOTION_TOKEN) return res.status(200).json({ skipped: 'NOTION_TOKEN が未設定です' });
  const out = { added: 0, moved: 0, checked: 0, errors: [] };
  for (const shelf of Object.keys(SHELF)) {
    try {
      const r = await fetch(`https://bookmeter.com/users/${USER}/books/${shelf}`, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'ja' } });
      if (!r.ok) { out.errors.push(shelf + ' ' + r.status); continue; }
      const items = parse(await r.text()).items.map((x) => ({ ...x, shelf }));
      if (!items.length) continue;
      out.checked += items.length;
      // Notion に既にある本をまとめて調べる
      const filter = { or: items.map((x) => ({ property: '読書メーターID', rich_text: { equals: String(x.id) } })) };
      const found = new Map((await queryPage(filter)).results.map(fromPage).map((x) => [x.id, x]));
      for (const it of items) {
        const have = found.get(String(it.id));
        if (!have) {
          // ジャンルは空のまま追加し、Notion の AI エージェントに仕分けてもらう
          await createPage(it);
          out.added++; await sleep(150);
        } else if (have.shelf !== SHELF[shelf]) {
          await patchPage(have.pageId, { shelf });
          out.moved++; await sleep(150);
        }
      }
    } catch (e) { out.errors.push(shelf + ': ' + String(e.message || e).slice(0, 120)); }
    await sleep(800); // 読書メーターに負担をかけないよう、間をあける
  }
  // My Factory：後回しの数を数え、Gmail に今日の生産計画を送る（映画の取り込みより先に、短く済ませる）
  try { out.factory = await factoryMorning(); } catch (e) { out.errors.push('factory: ' + String(e.message || e).slice(0, 120)); }
  // 映画博物館：最新作（日本の公開作・上映中・公開予定・各サブスクの新着）を毎朝取り込む
  if (process.env.TMDB_API_KEY) {
    try { const m = await ingestLatest(170000); out.movies = { added: m.added.length, checked: m.checked, done: m.done }; } catch (e) { out.errors.push('movies: ' + String(e.message || e).slice(0, 120)); }
  }
  res.status(200).json(out);
}
