// GPS のランニング画面
// 走った距離・時間・ペースを測り、ルートとラップを Notion「トレーニング」に残す。
// 前回までの記録から「目安のペース」を出し、走っている最中に先行・遅れを知らせる（データ→次の行動）。
const PASS = 'my-library:passcode';
const LIVE = 'my-library:run:live:v1';
const VOICE = 'my-library:run:voice';
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function dist(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const fmtTime = (ms) => { const s = Math.max(0, ms / 1000); const h = Math.floor(s / 3600); return (h ? h + ':' + pad((s % 3600) / 60) : pad(s / 60)) + ':' + pad(s % 60); };
const fmtPace = (minPerKm) => (!minPerKm || !Number.isFinite(minPerKm) || minPerKm > 60 ? "--'--\"" : Math.floor(minPerKm) + "'" + pad((minPerKm % 1) * 60) + '"');
// Google の polyline 形式（ルートを短い文字にする）
export function encodeRoute(pts) {
  let out = '', pl = 0, pg = 0;
  const enc = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  pts.forEach(([la, lg]) => { const a = Math.round(la * 1e5), b = Math.round(lg * 1e5); out += enc(a - pl) + enc(b - pg); pl = a; pg = b; });
  return out;
}
export function decodeRoute(str) {
  const pts = []; let i = 0, la = 0, lg = 0;
  const dec = () => { let r = 0, s = 0, b; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20 && i <= str.length); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < (str || '').length) { la += dec(); lg += dec(); pts.push([la / 1e5, lg / 1e5]); }
  return pts;
}
// 地図（Leaflet）は必要になったときだけ読み込む
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletP) return leafletP;
  leafletP = new Promise((ok, ng) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.append(css);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => ok(window.L); s.onerror = ng; document.head.append(s);
    setTimeout(() => ng(new Error('timeout')), 12000);
  });
  return leafletP;
}

export function createRun({ toast, history, onSaved }) {
  const style = document.createElement('style');
  style.textContent = `#run{position:fixed;inset:0;z-index:30;background:#0f0d0a;color:#f3ead6;display:none;flex-direction:column;font-family:var(--ui);padding:calc(env(safe-area-inset-top,0px) + 10px) 14px calc(env(safe-area-inset-bottom,0px) + 12px)}
#run.open{display:flex}#run .rh{display:flex;align-items:center;justify-content:space-between;gap:8px}#run .rh b{font-family:var(--display);font-size:18px}
#run .rx{height:38px;padding:0 14px;border-radius:12px;border:1px solid rgba(210,170,85,.45);background:transparent;color:#EBD08F;font-size:13px}
#runMap{flex:1 1 34vh;min-height:150px;margin:10px 0;border-radius:14px;overflow:hidden;background:#1b1914;position:relative}
#runMap canvas{width:100%;height:100%;display:block}
.rn-gps{font-size:11.5px;color:#a89f8a;margin-top:2px}.rn-gps[data-ok='1']{color:#8fd6a5}
.rn-big{text-align:center;font-size:58px;font-weight:800;line-height:1;font-family:var(--display)}.rn-big small{font-size:20px;margin-left:4px;color:#c9bfa6}
.rn-row{display:flex;gap:8px;margin-top:8px}.rn-row div{flex:1;text-align:center;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:6px 4px}.rn-row b{display:block;font-size:22px;font-family:var(--display)}.rn-row span{font-size:11px;color:#a89f8a}
.rn-bar{height:8px;border-radius:4px;background:rgba(255,255,255,.1);margin-top:10px;overflow:hidden}.rn-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c9a04e,#f0d48a)}
.rn-ghost{text-align:center;font-size:13px;margin-top:6px;min-height:18px}.rn-ghost[data-s='ahead']{color:#8fd6a5}.rn-ghost[data-s='behind']{color:#f2b49a}
.rn-tg{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.rn-tg button{flex:1;min-width:52px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#d8cfb8;font-size:13px}.rn-tg button[aria-pressed=true]{background:#c9a04e;color:#1b150b;border-color:#c9a04e;font-weight:700}
.rn-laps{font-size:12px;color:#c9bfa6;margin-top:8px;display:flex;gap:10px;overflow-x:auto;white-space:nowrap}
.rn-acts{display:flex;gap:8px;margin-top:12px}.rn-acts button{flex:1;height:58px;border-radius:16px;border:none;font-size:18px;font-weight:800;font-family:var(--ui)}
.rn-go{background:#2d8a4e;color:#fff}.rn-pause{background:#c9a04e;color:#1b150b}.rn-stop{background:#8a2a2a;color:#fff}
.rn-sum{margin-top:8px;font-size:13px;line-height:1.7}.rn-sum textarea{width:100%;box-sizing:border-box;height:60px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#1b1914;color:#f3ead6;font-size:15px;padding:8px;margin-top:6px}
.rn-opt{display:flex;align-items:center;gap:6px;font-size:12px;color:#a89f8a;margin-top:6px}`;
  document.head.append(style);
  const el = document.createElement('section');
  el.id = 'run';
  el.innerHTML = `<div class='rh'><div><b id='rnTitle'>ランニング</b><div class='rn-gps' id='rnGps'>GPSを準備しています…</div></div><button class='rx' id='rnClose' type='button'>閉じる</button></div>
  <div id='runMap'></div>
  <div class='rn-big'><span id='rnDist'>0.00</span><small>km</small></div>
  <div class='rn-row'><div><b id='rnTime'>00:00</b><span>時間</span></div><div><b id='rnPace'>--'--"</b><span>いまのペース</span></div><div><b id='rnAvg'>--'--"</b><span>平均ペース</span></div></div>
  <div class='rn-bar'><i id='rnBar'></i></div>
  <div class='rn-ghost' id='rnGhost'></div>
  <div class='rn-tg' id='rnTarget'></div>
  <div class='rn-laps' id='rnLaps'></div>
  <label class='rn-opt'><input type='checkbox' id='rnVoice'> 1kmごとに声で知らせる</label>
  <div id='rnSum'></div>
  <div class='rn-acts' id='rnActs'></div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  $('rnVoice').checked = localStorage.getItem(VOICE) !== '0';
  $('rnVoice').addEventListener('change', () => localStorage.setItem(VOICE, $('rnVoice').checked ? '1' : '0'));

  // ---------------- 状態
  let S = null; // { type, target, state:'ready'|'run'|'pause'|'done', pts, dist, elapsed, since, laps, lastFix }
  let watch = null, wake = null, tick = null, map = null, line = null, me = null, canvas = null;
  const fresh = (type) => ({ type, target: 0, state: 'ready', pts: [], dist: 0, elapsed: 0, since: 0, laps: [], startedAt: 0, acc: null });
  const elapsed = () => S.elapsed + (S.state === 'run' ? Date.now() - S.since : 0);
  function save() { try { if (S && (S.state === 'run' || S.state === 'pause')) localStorage.setItem(LIVE, JSON.stringify({ ...S, elapsed: elapsed(), since: Date.now(), savedAt: Date.now() })); } catch (e) { /* 続ける */ } }
  const clearLive = () => { try { localStorage.removeItem(LIVE); } catch (e) { /* 続ける */ } };

  // 前回までの記録から「目安のペース」（同じ種目の GPS 記録の最近5回の平均、なければ手入力も含める）
  function ghostPace(type) {
    const list = (history() || []).filter((r) => r.type === type && r.pace && r.km >= 1);
    const gps = list.filter((r) => r.method === 'GPS');
    const use = (gps.length ? gps : list).slice(0, 5);
    if (!use.length) return null;
    return use.reduce((s, r) => s + r.pace, 0) / use.length;
  }

  // ---------------- 地図
  async function setupMap() {
    const box = $('runMap'); box.innerHTML = '';
    try {
      const L = await loadLeaflet();
      const div = document.createElement('div'); div.style.cssText = 'width:100%;height:100%'; box.append(div);
      map = L.map(div, { zoomControl: false, attributionControl: true }).setView([35.74, 139.85], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      line = L.polyline([], { color: '#e8b04a', weight: 5 }).addTo(map);
      me = L.circleMarker([35.74, 139.85], { radius: 7, color: '#fff', weight: 2, fillColor: '#2d8a4e', fillOpacity: 1 }).addTo(map);
    } catch (e) {
      map = null; canvas = document.createElement('canvas'); box.append(canvas);
    }
    drawMap(true);
  }
  function drawMap(fit) {
    const pts = S ? S.pts.map((p) => [p[0], p[1]]) : [];
    if (map && window.L) {
      line.setLatLngs(pts);
      const last = pts[pts.length - 1] || (S && S.lastFix);
      if (last) { me.setLatLng(last); if (fit && pts.length > 1) map.fitBounds(line.getBounds(), { padding: [20, 20] }); else map.panTo(last, { animate: true }); }
      return;
    }
    if (!canvas) return;
    const w = canvas.width = canvas.clientWidth * 2, hgt = canvas.height = canvas.clientHeight * 2;
    const g = canvas.getContext('2d'); g.fillStyle = '#1b1914'; g.fillRect(0, 0, w, hgt);
    if (pts.length < 2) { g.fillStyle = '#7d7462'; g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText('地図を読み込めなかったので、ルートだけ描きます', w / 2, hgt / 2); return; }
    const la = pts.map((p) => p[0]), lg = pts.map((p) => p[1]);
    const a0 = Math.min(...la), a1 = Math.max(...la), b0 = Math.min(...lg), b1 = Math.max(...lg);
    const kx = Math.cos(rad((a0 + a1) / 2));
    const sc = Math.min((w - 40) / Math.max(1e-6, (b1 - b0) * kx), (hgt - 40) / Math.max(1e-6, a1 - a0));
    g.strokeStyle = '#e8b04a'; g.lineWidth = 6; g.beginPath();
    pts.forEach(([x, y], i) => { const px = 20 + (y - b0) * kx * sc, py = hgt - 20 - (x - a0) * sc; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
  }

  // ---------------- GPS
  function onFix(pos) {
    const { latitude: la, longitude: lg, accuracy } = pos.coords;
    S.acc = accuracy; S.lastFix = [la, lg];
    const gps = $('rnGps'); gps.dataset.ok = accuracy <= 30 ? '1' : '0';
    gps.textContent = accuracy <= 30 ? 'GPS良好（±' + Math.round(accuracy) + 'm）' : 'GPSの精度を待っています（±' + Math.round(accuracy) + 'm）';
    if (S.state !== 'run') { drawMap(false); return; }
    if (accuracy > 35) return; // 精度の悪い点は使わない
    const p = [la, lg, Date.now()];
    const prev = S.pts[S.pts.length - 1];
    if (prev) {
      const d = dist(prev, p), dt = (p[2] - prev[2]) / 1000;
      if (d < 4) return; // 止まっているときの揺れ
      if (dt > 0 && d / dt > (S.type === 'サイクリング' ? 25 : 9)) return; // 飛び（ありえない速さ）
      const before = S.dist; S.dist += d;
      const kmBefore = Math.floor(before / 1000), kmNow = Math.floor(S.dist / 1000);
      if (kmNow > kmBefore) lap(kmNow);
    }
    S.pts.push(p);
    drawMap(false); render();
  }
  function lap(km) {
    const t = elapsed(); const prevT = S.laps.reduce((s, l) => s + l, 0);
    const lapMs = t - prevT; S.laps.push(lapMs);
    const msg = km + 'キロ。ラップ ' + Math.floor(lapMs / 60000) + '分' + Math.round((lapMs % 60000) / 1000) + '秒。';
    toast(km + 'km　ラップ ' + fmtTime(lapMs));
    if ($('rnVoice').checked && window.speechSynthesis) { try { const u = new SpeechSynthesisUtterance(msg + ghostText(true)); u.lang = 'ja-JP'; speechSynthesis.speak(u); } catch (e) { /* 声が出せなくても続ける */ } }
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
  }
  function ghostText(voice) {
    const gp = ghostPace(S.type); if (!gp || S.dist < 200) return '';
    const expect = (S.dist / 1000) * gp * 60000; const diff = Math.round((elapsed() - expect) / 1000);
    if (Math.abs(diff) < 3) return voice ? 'いつものペースどおり。' : 'いつものペースどおり';
    const s = Math.abs(diff); const t = s >= 60 ? Math.floor(s / 60) + '分' + (s % 60) + '秒' : s + '秒';
    return diff < 0 ? (voice ? 'いつもより' + t + '速い。' : 'いつものペースより ' + t + ' 先行') : (voice ? 'いつもより' + t + '遅れ。' : 'いつものペースより ' + t + ' 遅れ');
  }
  async function keepAwake() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; } }
  document.addEventListener('visibilitychange', () => { if (S && S.state === 'run' && document.visibilityState === 'visible') keepAwake(); });
  function startGps() {
    if (watch !== null || !navigator.geolocation) { if (!navigator.geolocation) $('rnGps').textContent = 'この端末ではGPSを使えません'; return; }
    watch = navigator.geolocation.watchPosition(onFix, (err) => { $('rnGps').dataset.ok = '0'; $('rnGps').textContent = err.code === 1 ? '位置情報が許可されていません（ブラウザの設定で許可してください）' : 'GPSを受信できません（空の見える場所へ）'; }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
  function stopGps() { if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null; if (wake) { wake.release().catch(() => {}); wake = null; } }

  // ---------------- 表示
  const TARGETS = [[0, '自由'], [3, '3km'], [5, '5km'], [10, '10km'], [21.1, 'ハーフ']];
  function render() {
    const km = S.dist / 1000, t = elapsed();
    $('rnDist').textContent = km.toFixed(2);
    $('rnTime').textContent = fmtTime(t);
    $('rnAvg').textContent = km > 0.05 ? fmtPace(t / 60000 / km) : "--'--\"";
    // いまのペース：直近 200m（なければ直近の点）で計算
    let cur = null;
    for (let i = S.pts.length - 1, d = 0; i > 0; i--) { d += dist(S.pts[i - 1], S.pts[i]); if (d >= 200 || i === 1) { const dt = (S.pts[S.pts.length - 1][2] - S.pts[i - 1][2]) / 60000; cur = d > 30 ? dt / (d / 1000) : null; break; } }
    $('rnPace').textContent = fmtPace(cur);
    $('rnBar').style.width = S.target ? Math.min(100, (km / S.target) * 100) + '%' : '0';
    const g = $('rnGhost'); const gt = ghostText(false);
    g.textContent = S.state === 'ready' ? (ghostPace(S.type) ? '目安のペース（最近の平均）：' + fmtPace(ghostPace(S.type)) + '/km' : 'はじめての記録です。まずは気持ちよく走りましょう') : (S.target ? '残り ' + Math.max(0, S.target - km).toFixed(2) + ' km　' : '') + gt;
    g.dataset.s = gt.includes('先行') ? 'ahead' : gt.includes('遅れ') ? 'behind' : '';
    $('rnLaps').textContent = S.laps.map((l, i) => (i + 1) + 'km ' + fmtTime(l)).join('　');
    // 目標
    const tg = $('rnTarget'); tg.innerHTML = ''; tg.style.display = S.state === 'ready' ? 'flex' : 'none';
    TARGETS.forEach(([v, label]) => { const b = h('button', '', label); b.type = 'button'; b.setAttribute('aria-pressed', S.target === v ? 'true' : 'false'); b.addEventListener('click', () => { S.target = v; render(); }); tg.append(b); });
    // ボタン
    const acts = $('rnActs'); acts.innerHTML = '';
    const btn = (cls, label, fn) => { const b = h('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); acts.append(b); };
    if (S.state === 'ready') btn('rn-go', 'スタート', start);
    else if (S.state === 'run') { btn('rn-pause', '一時停止', pause); btn('rn-stop', '終了', finish); }
    else if (S.state === 'pause') { btn('rn-go', '再開', resume); btn('rn-stop', '終了', finish); }
    $('rnClose').style.visibility = S.state === 'run' || S.state === 'pause' ? 'hidden' : 'visible';
  }
  function start() { S.state = 'run'; S.since = Date.now(); S.startedAt = S.startedAt || Date.now(); keepAwake(); startGps(); if (S.lastFix && S.acc <= 35) S.pts.push([S.lastFix[0], S.lastFix[1], Date.now()]); save(); render(); toast('計測を始めました。画面はつけたままにしてね'); }
  function pause() { S.elapsed = elapsed(); S.state = 'pause'; save(); render(); }
  function resume() { S.state = 'run'; S.since = Date.now(); keepAwake(); render(); }
  function finish() {
    if (S.state === 'run') S.elapsed = elapsed();
    S.state = 'done'; stopGps(); clearInterval(tick); tick = null; clearLive();
    const km = S.dist / 1000, min = S.elapsed / 60000, pace = km > 0 ? min / km : 0;
    const gp = ghostPace(S.type);
    const sum = $('rnSum'); sum.innerHTML = '';
    const box = h('div', 'rn-sum');
    box.append(h('div', '', km.toFixed(2) + ' km　' + fmtTime(S.elapsed) + '　平均 ' + fmtPace(pace) + '/km'));
    if (gp && km >= 0.5) { const d = (pace - gp) * 60; box.append(h('div', '', Math.abs(d) < 3 ? '最近の平均とほぼ同じペースでした' : '最近の平均より 1kmあたり ' + Math.round(Math.abs(d)) + '秒 ' + (d < 0 ? '速かった！' : 'ゆっくりでした'))); }
    const week = (history() || []).filter((r) => r.date >= weekStart()).reduce((s, r) => s + (r.km || 0), 0);
    box.append(h('div', '', '今週の合計：' + (week + km).toFixed(1) + ' km'));
    const memo = document.createElement('textarea'); memo.placeholder = 'メモ（体調・コースなど）'; box.append(memo);
    sum.append(box);
    $('rnTarget').style.display = 'none';
    const acts = $('rnActs'); acts.innerHTML = '';
    const ok = h('button', 'rn-go', 'Notionに保存'); ok.type = 'button';
    const no = h('button', 'rn-stop', '保存しない'); no.type = 'button';
    ok.addEventListener('click', async () => {
      ok.disabled = true; ok.textContent = '保存しています…';
      const rec = { kind: 'training', type: S.type, date: new Date(S.startedAt + 9 * 3600 * 1000).toISOString().slice(0, 10), minutes: Math.round(min * 10) / 10, km: Math.round(km * 100) / 100, method: 'GPS', memo: memo.value, laps: S.laps.map((l, i) => (i + 1) + 'km ' + fmtTime(l)).join(' / '), route: encodeRoute(thin(S.pts)) };
      try {
        const r = await fetch('/api/sports', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(PASS) || '' }, body: JSON.stringify(rec) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
        onSaved(j.record); toast(S.type + ' ' + km.toFixed(2) + 'km を記録しました（Notion「トレーニング」）'); close(true);
      } catch (e) { ok.disabled = false; ok.textContent = 'もう一度保存する'; toast('保存できませんでした：' + String(e.message || e).slice(0, 60)); }
    });
    no.addEventListener('click', () => { if (window.confirm('この記録を保存せずに閉じますか？')) close(true); });
    acts.append(ok, no);
    drawMap(true);
    $('rnClose').style.visibility = 'hidden';
  }
  // 保存用にルートの点を間引く（8m 未満の点を省く）
  function thin(pts) { const out = []; pts.forEach((p) => { if (!out.length || dist(out[out.length - 1], p) >= 8) out.push(p); }); return out; }
  const weekStart = () => { const n = new Date(Date.now() + 9 * 3600 * 1000); const d = (n.getUTCDay() + 6) % 7; n.setUTCDate(n.getUTCDate() - d); return n.toISOString().slice(0, 10); };

  // ---------------- 開く・閉じる
  function open(type) {
    let live = null; try { live = JSON.parse(localStorage.getItem(LIVE) || 'null'); } catch (e) { live = null; }
    if (live && Date.now() - live.savedAt < 6 * 3600 * 1000 && window.confirm('途中の記録（' + (live.dist / 1000).toFixed(2) + 'km）があります。続きから再開しますか？')) {
      S = live; S.state = 'pause'; S.since = Date.now();
    } else { clearLive(); S = fresh(type || 'ランニング'); }
    $('rnTitle').textContent = S.type + '（GPS）'; $('rnSum').innerHTML = '';
    el.classList.add('open'); setupMap(); startGps(); render();
    clearInterval(tick); tick = setInterval(() => { if (S && S.state === 'run') { render(); } if (S && Date.now() % 5000 < 1000) save(); }, 1000);
  }
  function close(force) {
    if (!force && S && (S.state === 'run' || S.state === 'pause')) return;
    stopGps(); clearInterval(tick); tick = null; el.classList.remove('open'); S = null;
    if (map) { map.remove(); map = null; } canvas = null;
  }
  $('rnClose').addEventListener('click', () => close(false));
  // 過去の記録のルートを見る
  async function showRoute(rec) {
    S = fresh(rec.type); S.state = 'view';
    S.pts = decodeRoute(rec.route || '').map((p) => [p[0], p[1], 0]); S.dist = (rec.km || 0) * 1000; S.elapsed = (rec.minutes || 0) * 60000;
    S.laps = [];
    $('rnTitle').textContent = rec.date + '　' + (rec.title || rec.type); $('rnSum').innerHTML = '';
    el.classList.add('open'); await setupMap(); render();
    $('rnTarget').style.display = 'none'; $('rnActs').innerHTML = ''; $('rnGhost').textContent = rec.laps || ''; $('rnGps').textContent = 'ルートの記録'; $('rnClose').style.visibility = 'visible';
    drawMap(true);
  }
  return { open, close, showRoute };
}
