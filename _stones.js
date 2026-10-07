// /api/stones（vercel.json の rewrites で /api/meter-notion?mode=stones に回す）
// SixTONES館：公式YouTubeチャンネルの新着動画（公開RSS）と、グループ・メンバーごとのニュース見出し（Google ニュースRSS）を集める。
// 記事本文や写真は取り込まず、見出し・出典・リンクだけを扱う。
const UA = { 'User-Agent': 'Mozilla/5.0 (MyLibrary personal app)', 'Accept-Language': 'ja,en;q=0.8' };
const HANDLE = process.env.SIXTONES_HANDLE || '@SixTONES_official';
const QUERIES = {
  group: 'SixTONES', jesse: 'ジェシー SixTONES', taiga: '京本大我', hokuto: '松村北斗',
  kochi: '髙地優吾', shintaro: '森本慎太郎', juri: '田中樹 SixTONES',
};
let cache = { at: 0, data: null };
let channelId = process.env.SIXTONES_CHANNEL_ID || '';

const unesc = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).trim();
const tag = (s, t) => { const m = s.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? unesc(m[1]) : ''; };
async function get(url, ms = 7000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: UA, signal: c.signal, redirect: 'follow' }); if (!r.ok) throw new Error(String(r.status)); return await r.text(); } finally { clearTimeout(t); }
}
async function resolveChannel() {
  if (channelId) return channelId;
  const html = await get('https://www.youtube.com/' + HANDLE);
  const m = html.match(/"channelId":"(UC[\w-]{22})"/) || html.match(/channel\/(UC[\w-]{22})/) || html.match(/"externalId":"(UC[\w-]{22})"/);
  if (!m) throw new Error('チャンネルが見つかりません');
  channelId = m[1];
  return channelId;
}
async function videos() {
  const id = await resolveChannel();
  const xml = await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + id);
  return xml.split('<entry>').slice(1).map((e) => {
    const vid = tag(e, 'yt:videoId');
    return { id: vid, title: tag(e, 'title'), published: tag(e, 'published'), url: 'https://www.youtube.com/watch?v=' + vid, thumb: 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg', views: +((e.match(/views="(\d+)"/) || [])[1] || 0), short: /#shorts|#Shorts/.test(e) };
  }).filter((v) => v.id);
}
async function news(q) {
  const xml = await get('https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=ja&gl=JP&ceid=JP:ja');
  return xml.split('<item>').slice(1, 16).map((it) => {
    const title = tag(it, 'title'), source = tag(it, 'source');
    return { title: source && title.endsWith(' - ' + source) ? title.slice(0, -(source.length + 3)) : title, link: tag(it, 'link'), date: tag(it, 'pubDate'), source };
  }).filter((n) => n.title && /^https?:/.test(n.link));
}

export async function stones(req, res) {
  try {
    if (req.query.channel) channelId = String(req.query.channel).match(/UC[\w-]{22}/)?.[0] || channelId;
    const fresh = req.query.refresh || !cache.data || Date.now() - cache.at > 30 * 60 * 1000;
    if (fresh) {
      const keys = Object.keys(QUERIES);
      const [v, ...ns] = await Promise.allSettled([videos(), ...keys.map((k) => news(QUERIES[k]))]);
      const out = { channelId, videos: v.status === 'fulfilled' ? v.value : [], videoError: v.status === 'rejected' ? String(v.reason && v.reason.message || v.reason).slice(0, 120) : '', news: {}, at: new Date().toISOString() };
      keys.forEach((k, i) => { out.news[k] = ns[i].status === 'fulfilled' ? ns[i].value : []; });
      if (out.videos.length || keys.some((k) => out.news[k].length)) cache = { at: Date.now(), data: out };
      else if (!cache.data) cache = { at: 0, data: out };
    }
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(cache.data);
  } catch (e) { return res.status(502).json({ error: String(e.message || e).slice(0, 200) }); }
}
