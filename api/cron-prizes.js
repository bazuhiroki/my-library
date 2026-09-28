// 毎日1回（vercel.json の crons）：最新の芥川賞・直木賞が Notion になければ追加する
import { readNotion, readOfficialLatest, missing, addToNotion } from './_lib.js';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  if (!process.env.NOTION_TOKEN) return res.status(200).json({ skipped: 'NOTION_TOKEN が未設定です' });
  const rows = await readNotion();
  const latest = await readOfficialLatest();
  const add = missing(latest, rows);
  const added = [];
  for (const r of add) { await addToNotion(r); added.push(`${r[2]} ${r[5]} ${r[0]}／${r[1]}`); }
  res.status(200).json({ checked: latest.length, added });
}
