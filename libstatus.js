// 「利用状況の窓口」：葛飾区立図書館で借りている本・予約している本を、アプリの中で確かめる
const KEY = 'my-library:libstatus:v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 保存できなくても続ける */ } };
const dateOf = (s) => { const m = String(s || '').match(/(\d{4})[\/年.\-](\d{1,2})[\/月.\-](\d{1,2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const daysLeft = (d) => Math.round((d - new Date(new Date().toDateString())) / 86400000);
// 取置期限が付いている（＝貸出可で取り置き中）本は、受け取りに行ける
const isReady = (x) => !!x.until || /貸出可|取置|到着|用意|受取可/.test(x.status || '');

export function createLibStatus({ toast }) {
  let data = load();
  let busy = false;
  const el = document.createElement('section');
  el.id = 'ls';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class='card'>
    <div class='chead'><h2>利用状況の窓口</h2><button id='lsClose' type='button'>閉じる</button></div>
    <p class='ls-note' id='lsNote'></p>
    <h3 class='ls-h'>借りている本</h3><ul class='ls-list' id='lsLoans'></ul>
    <h3 class='ls-h'>予約している本</h3><ul class='ls-list' id='lsRes'></ul>
    <div class='ls-tools'><button id='lsRefresh' type='button'>最新にする</button><a id='lsOpen' href='https://www.lib.city.katsushika.lg.jp/idcheck' target='_blank' rel='noopener'>図書館のサイトで見る</a></div>
  </div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const li = (main, sub, tone) => { const l = document.createElement('li'); if (tone) l.dataset.tone = tone; const b = document.createElement('b'); b.textContent = main; const s = document.createElement('span'); s.textContent = sub; l.append(b, s); return l; };
  function render() {
    const note = $('lsNote');
    if (busy) note.textContent = '図書館に問い合わせています…（10秒ほどかかります）';
    else if (!data) note.textContent = 'まだ確認していません。「最新にする」を押してください。';
    else if (!data.ok) note.textContent = '確認できませんでした：' + (data.error || '');
    else note.textContent = new Date(data.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' の状況';
    const L = $('lsLoans'), R = $('lsRes'); L.innerHTML = ''; R.innerHTML = '';
    const loans = (data && data.loans) || [], res = (data && data.reserves) || [];
    loans.forEach((x) => {
      const d = dateOf(x.due); const n = d ? daysLeft(d) : null;
      const sub = [x.due ? '返却期限 ' + x.due : '', n === null ? '' : n < 0 ? '（' + -n + '日すぎています）' : n === 0 ? '（今日まで）' : '（あと' + n + '日）'].join('');
      L.append(li(x.title, sub || x.status || '', n !== null && n <= 3 ? 'warn' : ''));
    });
    res.slice().sort((a, b) => isReady(b) - isReady(a)).forEach((x) => {
      const ready = isReady(x);
      const ud = dateOf(x.until); const un = ud ? daysLeft(ud) : null;
      const sub = [ready ? '受け取れます' : x.status, x.rank ? x.rank + '番目' : '', x.place ? '受取 ' + x.place : '', x.until ? '取置期限 ' + x.until + (un === null ? '' : un <= 0 ? '（今日まで）' : '（あと' + un + '日）') : ''].filter(Boolean).join('　');
      R.append(li(x.title, sub, ready ? 'ready' : ''));
    });
    if (data && data.ok && !loans.length) L.append(li('いま借りている本はありません', ''));
    if (data && data.ok && !res.length) R.append(li('いま予約している本はありません', ''));
    updateChip();
  }
  async function refresh() {
    if (busy) return;
    busy = true; render();
    try {
      const j = await (await fetch('/api/library')).json();
      if (j.available === false) data = { ok: false, error: j.error || '設定がありません' };
      else { data = j; if (j.ok) save(j); }
      if (j.ok) {
        const ready = (j.reserves || []).filter(isReady).length;
        const soon = (j.loans || []).filter((x) => { const d = dateOf(x.due); return d && daysLeft(d) <= 3; }).length;
        toast(ready ? '受け取れる予約の本が' + ready + '冊あります' : soon ? '返却期限が近い本が' + soon + '冊あります' : '利用状況を更新しました');
      }
    } catch (e) { data = { ok: false, error: String(e.message || e) }; }
    busy = false; render();
  }
  const chip = document.createElement('button');
  chip.className = 'chip small'; chip.id = 'lsChip'; chip.type = 'button';
  function updateChip() {
    const loans = (data && data.loans) || [], res = (data && data.reserves) || [];
    const ready = res.filter(isReady).length;
    chip.textContent = '図書館　借' + loans.length + '・予約' + res.length + (ready ? '（受取' + ready + '）' : '');
    chip.dataset.alert = ready ? '1' : '';
    chip.style.display = 'block';
  }
  chip.addEventListener('click', () => open());
  const anchor = document.getElementById('bmChip') || document.getElementById('arcChip');
  if (anchor && anchor.parentNode) anchor.after(chip);
  // 貸出カウンターの中からも開けるように
  const cl = document.getElementById('cList');
  if (cl && cl.parentNode) {
    const b2 = document.createElement('button');
    b2.type = 'button'; b2.textContent = '予約・貸出の状況を見る（利用状況の窓口）';
    b2.style.cssText = 'width:100%;height:42px;margin:4px 0 10px;border-radius:12px;border:1px solid rgba(120,170,220,.55);background:rgba(120,170,220,.12);color:#cfe2f3;font-family:var(--ui);font-size:13px;cursor:pointer';
    b2.addEventListener('click', () => open());
    cl.parentNode.insertBefore(b2, cl);
  }
  function open() { el.classList.add('open'); render(); if (!data || !data.ok || Date.now() - new Date(data.at).getTime() > 30 * 60 * 1000) refresh(); }
  function close() { el.classList.remove('open'); }
  $('lsClose').addEventListener('click', close);
  $('lsRefresh').addEventListener('click', refresh);
  updateChip();
  return { open, close, refresh };
}
