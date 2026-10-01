// 読みたい本リスト。Notion「読書管理」に保存し、つながらないときはこの端末に保存しておいて後で送る
const LOCAL = 'my-library:wish-local:v1', KEY = 'my-library:passcode';
const load = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch (_) { return []; } };
const save = (v) => { try { localStorage.setItem(LOCAL, JSON.stringify(v)); } catch (_) {} };
const headers = () => ({ 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(KEY) || '' });

export function createWishlist({ onChange }) {
  let items = [];           // {id,title,authors,isbn,publisher,cover,status,library,created,pending?}
  let mode = 'local';       // 'notion' | 'local'
  const changed = () => onChange && onChange(items, mode);

  async function call(method, body, q = '') {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch('/api/wishlist' + q, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
      if (r.status === 401) { const p = window.prompt('合言葉を入れてね（Vercel の APP_PASSCODE）'); if (!p) throw new Error('passcode'); localStorage.setItem(KEY, p); continue; }
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }
    throw new Error('passcode');
  }
  async function refresh() {
    try {
      const d = await call('GET');
      mode = 'notion';
      const pend = load();
      items = d.items.concat(pend.filter((p) => !d.items.some((i) => i.isbn && i.isbn === p.isbn)));
      changed();
      if (pend.length) sync();
    } catch (_) { mode = 'local'; items = load(); changed(); }
  }
  async function sync() {
    const pend = load(); const rest = [];
    for (const p of pend) {
      try { const d = await call('POST', p); const i = items.findIndex((x) => x.isbn === p.isbn); if (i >= 0) items[i] = d.item; }
      catch (_) { rest.push(p); }
    }
    save(rest); changed();
  }
  const has = (isbn) => items.some((i) => i.isbn === isbn);
  async function add(info) {
    if (info.isbn ? has(info.isbn) : items.some((i) => i.title === info.title)) return { duplicate: true };
    const draft = { id: 'local-' + (info.isbn || Date.now()), title: info.title, authors: info.authors || [], isbn: info.isbn, publisher: info.publisher || '', cover: info.cover || '', description: info.description || '', status: info.status || '未読', finished: info.finished || '', started: info.started || '', rating: info.rating || 0, note: info.note || '', library: '', created: new Date().toISOString(), pending: true };
    items.unshift(draft); changed();
    if (mode === 'notion') {
      try { const d = await call('POST', draft); const i = items.indexOf(draft); if (i >= 0) items[i] = d.item; changed(); return { saved: 'notion', duplicate: !!d.duplicate }; }
      catch (_) { /* 下で端末に保存 */ }
    }
    const pend = load(); pend.unshift(draft); save(pend);
    return { saved: 'local' };
  }
  async function remove(item) {
    items = items.filter((i) => i !== item); changed();
    if (item.pending || String(item.id).startsWith('local-')) { save(load().filter((p) => p.id !== item.id)); return; }
    try { await call('DELETE', null, '?id=' + encodeURIComponent(item.id)); } catch (_) {}
  }
  async function setStatus(item, status) {
    item.status = status; changed();
    if (item.pending) { const pend = load(); const p = pend.find((x) => x.isbn === item.isbn); if (p) { p.status = status; save(pend); } return; }
    try { await call('PATCH', { id: item.id, status }); } catch (_) {}
  }
  async function setFinished(item, date) {
    item.finished = date;
    if (item.pending || String(item.id).startsWith('local-')) return;
    try { await call('PATCH', { id: item.id, finished: date }); } catch (_) { /* 送れなくても端末の記録は残る */ }
  }
  const utimers = {};
  function update(item, fields, lazy) {
    Object.assign(item, fields);
    if (item.pending || String(item.id).startsWith('local-')) { const pend = load(); const p = pend.find((x) => x.id === item.id); if (p) { Object.assign(p, fields); save(pend); } return; }
    const send = () => call('PATCH', Object.assign({ id: item.id }, fields)).catch(() => {});
    if (lazy) { clearTimeout(utimers[item.id]); utimers[item.id] = setTimeout(send, 800); } else send();
  }
  return { refresh, add, remove, setStatus, setFinished, update, has, get items() { return items; }, get mode() { return mode; } };
}

export async function lookupIsbn(isbn) {
  const r = await fetch('/api/isbn?isbn=' + isbn);
  if (r.ok) return r.json();
  if (r.status === 404) return null;
  throw new Error(String(r.status));
}
export const coverUrl = (item) => '/api/cover?isbn=' + item.isbn + (item.cover ? '&src=' + encodeURIComponent(item.cover) : '');
