// いまいる場所（図書館・映画館・運動場・屋外）に合わせて、画面の表示を切り替える
// 図書館の中では本の情報、映画館では動画の情報、運動場では運動の記録を出す。
export function areaOf(p) {
  if (!p) return 'library';
  const { x, z } = p;
  if (Math.hypot(x + 63, z - 10) < 8.5) return 'mind';
  if (x > 49.5 && x < 72.5 && z > 37.5 && z < 54.5) return 'stones';
  if (x > 69.6 || (x > 45 && z < -34.3) || (x > 45 && x < 48 && z < -20.6)) return 'museum';
  if (x > 42.4) return z > 0 ? 'sports' : 'cinema';
  if (Math.abs(x) <= 6.3 && Math.abs(z) <= 22.7) return 'library';
  if (z < -22.3 && z > -35.6 && Math.abs(x) < 31) return 'library';
  return 'outdoor';
}
const NAMES = { library: 'My Library', cinema: 'My Cinema', sports: 'My Field', museum: 'My Museum', mind: '心の部屋', stones: 'SixTONES館', outdoor: 'My Library' };

export function createPlaces({ cinema, sports, museum, mind, stones }) {
  const style = document.createElement('style');
  // 図書館の外では本のための表示を隠し、その場所のための表示だけを出す
  style.textContent = `body[data-area]:not([data-area=library]) #bagChip,body[data-area]:not([data-area=library]) #wishChip,body[data-area]:not([data-area=library]) #arcChip,body[data-area]:not([data-area=library]) #bmChip,body[data-area]:not([data-area=library]) #lsChip,body[data-area]:not([data-area=library]) #scanBtn{display:none!important}
body:not([data-area=cinema]) #cineChip,body:not([data-area=cinema]) #cineChip2{display:none!important}
body:not([data-area=sports]) #sportChip,body:not([data-area=sports]) #sportChip2{display:none!important}
#cineChip,#cineChip2,#sportChip,#sportChip2{pointer-events:auto;cursor:pointer;font-family:var(--ui);text-align:left;display:block}
#cineChip,#cineChip2{border:1px solid rgba(232,196,106,.5);color:#f3dfa8}
#sportChip,#sportChip2{border:1px solid rgba(127,209,154,.5);color:#cfeedd}
body:not([data-area=museum]) #musChip,body:not([data-area=museum]) #musChip2{display:none!important}
#musChip,#musChip2{pointer-events:auto;cursor:pointer;font-family:var(--ui);text-align:left;display:block;border:1px solid rgba(200,190,230,.5);color:#e4ddf6}
body:not([data-area=mind]) #mindChip,body:not([data-area=mind]) #mindChip2{display:none!important}
#mindChip,#mindChip2{pointer-events:auto;cursor:pointer;font-family:var(--ui);text-align:left;display:block;border:1px solid rgba(160,210,180,.5);color:#d6eedd}
body:not([data-area=stones]) #stChip,body:not([data-area=stones]) #stChip2{display:none!important}
#stChip,#stChip2{pointer-events:auto;cursor:pointer;font-family:var(--ui);text-align:left;display:block;border:1px solid rgba(255,255,255,.55);color:#fff}`;
  document.head.append(style);
  const left = document.querySelector('#topbar .left');
  const chip = (id, onClick) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'chip small'; b.addEventListener('click', onClick); if (left) left.append(b); return b; };
  const c1 = chip('cineChip', () => cinema.open());
  const c2 = chip('cineChip2', () => cinema.open());
  const s1 = chip('sportChip', () => sports.open('train'));
  const s2 = chip('sportChip2', () => sports.open('weight'));
  const m1 = museum ? chip('musChip', () => museum.open()) : null;
  const m2 = museum ? chip('musChip2', () => museum.open()) : null;
  const k1 = mind ? chip('mindChip', () => mind.open()) : null;
  const k2 = mind ? chip('mindChip2', () => mind.open()) : null;
  const t1 = stones ? chip('stChip', () => stones.open({ tab: 'videos' })) : null;
  const t2 = stones ? chip('stChip2', () => stones.open({ tab: 'news' })) : null;
  // 虫めがねボタンは、その場所の「探す」に替える（映画館なら動画、運動場なら記録）
  let area = '';
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#searchBtn');
    if (!btn || area === 'library' || area === 'outdoor') return;
    e.stopPropagation(); e.preventDefault();
    if (area === 'cinema') cinema.open(); else if (area === 'museum' && museum) museum.open(); else if (area === 'mind' && mind) mind.open(); else if (area === 'stones' && stones) stones.open({}); else sports.open('log');
  }, true);
  function refresh() {
    const list = cinema.list || [];
    const want = list.filter((v) => v.status === '観たい').length;
    c1.textContent = cinema.now ? '上映中　' + String(cinema.now.title || cinema.now.service).slice(0, 14) : '上映室をひらく';
    c2.textContent = '動画 ' + list.length + '本・観たい ' + want + '本';
    const st = sports.weekStats(); const w = (sports.data.weight || [])[0];
    s1.textContent = '今週 ' + st.km.toFixed(1) + 'km・' + st.n + '回';
    s2.textContent = w ? '体重 ' + w.kg + 'kg' : '体重を記録する';
    if (t1) { const n = stones.newCount; t1.textContent = '新着動画' + (n ? '　' + n + '本' : 'を見る'); t2.textContent = 'ニュースを読む'; }
    if (k1) { k1.textContent = 'エルフと話す'; k2.textContent = '心の記録 ' + (mind.count || 0) + '件'; }
    if (m1) { const ml = museum.list || []; m1.textContent = '展示室の案内をひらく'; m2.textContent = '収蔵 ' + ml.length + '本・観たい ' + ml.filter((x) => x && x.status === '観たい').length + '本'; }
  }
  let t = 0;
  function update(dt, player) {
    t -= dt; if (t > 0) return; t = 0.4;
    const a = areaOf(player);
    if (a !== area) {
      area = a; document.body.dataset.area = a;
      const n = document.querySelector('#place .name'); if (n) n.textContent = NAMES[a];
      const sb = document.getElementById('searchBtn'); if (sb) sb.setAttribute('aria-label', a === 'cinema' ? '動画を探す' : a === 'sports' ? '運動の記録を見る' : '本を探す');
    }
    refresh();
  }
  document.body.dataset.area = 'library';
  return { update, get area() { return area; } };
}
