// ui.js
// DOM rendering functions and simple UI utilities
function renderAlbumList(filter = '') {
  const { albumsEl } = getDom();
  albumsEl.innerHTML = '';
  const q = filter.trim().toLowerCase();
  for (const zipUrl of state.albumOrder) {
    const album = state.library[zipUrl];
    const disp = album.displayName;
    if (q && disp.toLowerCase().indexOf(q) === -1) {
      const hasHit = (album.tracks || []).some(t => (t.filename || '').toLowerCase().includes(q));
      if (!hasHit) continue;
    }
    const a = document.createElement('div');
    a.className = 'album';
    a.setAttribute('role', 'listitem');
    a.dataset.zip = zipUrl;
    a.onclick = () => openAlbum(zipUrl);
    const img = document.createElement('img');
    img.alt = disp;
    img.src = album.art || placeholder(disp);
    img.loading = 'lazy';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<div style="font-weight:700">${disp}</div><div class="muted">${(album.tracks && album.tracks.length) || 'Loading'} tracks</div>`;
    a.appendChild(img); a.appendChild(meta);
    albumsEl.appendChild(a);
  }
}

function hookPlayers(hPlay, hEnqueue) {
  play = hPlay;
  enqueue = hEnqueue;
}

var UI = {
  hookPlayers: function(play, enqueue) { hookPlayers(play, enqueue); },
  renderAlbumList: function(q) { renderAlbumList(q); },
  renderTracklist: function(zipUrl) { renderTracklist(zipUrl); },
  updateAlbumThumb: function(zipUrl, pic) { updateAlbumThumb(zipUrl, pic); }
};

// renderTracklist requires openAlbum/play to exist in scope (main/player will provide)
function renderTracklist(zipUrl) {
  const { tracklistEl } = getDom();
  const album = state.library[zipUrl];
  tracklistEl.innerHTML = '';
  (album.tracks || []).forEach((t, idx) => {
    const tr = document.createElement('div');
    tr.className = 'track';
    tr.dataset.idx = idx;
    tr.onclick = (e) => {
      if (e.shiftKey) { enqueue(zipUrl, idx); return; }
      play(zipUrl, idx);
    };
    const idxEl = document.createElement('div'); idxEl.textContent = String(idx + 1).padStart(2, ' ');
    const meta = document.createElement('div');
    meta.innerHTML = `<div class="title">${t.title || titleFromFilename(t.filename)}</div><div class="title-sub">${t.artist || ''}</div>`;
    const dur = document.createElement('div'); dur.className = 'small-muted'; dur.textContent = t.duration ? fmt(t.duration) : '';
    tr.appendChild(idxEl); tr.appendChild(meta); tr.appendChild(dur);
    const enqueueBtn = document.createElement('button'); enqueueBtn.className = 'btn'; enqueueBtn.textContent = '⋯'; enqueueBtn.title = 'Track actions';
    enqueueBtn.onclick = (ev) => { ev.stopPropagation(); showTrackActions(zipUrl, idx, tr); };
    tr.appendChild(enqueueBtn);
    tracklistEl.appendChild(tr);
  });
}

function updateTrackRow(index, track) {
  const { tracklistEl } = getDom();
  const row = tracklistEl.querySelector(`.track[data-idx='${index}']`);
  if (!row) return;
  row.querySelector('.title').textContent = track.title || titleFromFilename(track.filename);
  row.querySelector('.title-sub').textContent = track.artist || '';
  const durEl = row.querySelector('.small-muted');
  durEl && (durEl.textContent = track.duration ? fmt(track.duration) : '');
}

function updateAlbumThumb(zipUrl, artUrl) {
  const { albumsEl } = getDom();
  const items = Array.from(albumsEl.querySelectorAll('.album'));
  items.forEach(item => {
    if (item.dataset.zip === zipUrl) {
      const img = item.querySelector('img');
      if (img) img.src = artUrl;
    }
  });
}

function updateAlbumName(zipUrl, name) {
  const { albumsEl } = getDom();
  const item = albumsEl.querySelector(`.album[data-zip="${zipUrl}"]`);
  if (item) {
    item.querySelector('.meta > div:first-child').textContent = name;
  }
}

function renderQueue() {
  const { queueEl, queueCountEl } = getDom();
  queueEl.innerHTML = '';
  queueCountEl.textContent = String(state.queue.length);
  state.queue.forEach((q, i) => {
    const album = state.library[q.album];
    const t = (album && album.tracks && album.tracks[q.index]) || { filename: 'Unknown' };
    const item = document.createElement('div'); item.className = 'qitem';
    const img = document.createElement('img'); img.src = album.art || t.picture || placeholder(album.displayName);
    const meta = document.createElement('div'); meta.innerHTML = `<div style="font-weight:700">${t.title || titleFromFilename(t.filename)}</div><div class="small-muted">${t.artist || ''} • ${album.displayName}</div>`;
    const rem = document.createElement('button'); rem.className = 'btn'; rem.textContent = '✕'; rem.onclick = () => { state.queue.splice(i, 1); renderQueue(); };
    item.appendChild(img); item.appendChild(meta); item.appendChild(rem);
    queueEl.appendChild(item);
  });
}

function showTrackActions(zipUrl, idx, el) {
  const existing = document.getElementById('track-actions');
  if (existing) existing.remove();
  const popup = document.createElement('div');
  popup.id = 'track-actions';
  popup.style.position = 'absolute';
  popup.style.background = 'var(--panel)';
  popup.style.color = 'inherit';
  popup.style.borderRadius = '8px';
  popup.style.padding = '8px';
  popup.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
  popup.style.zIndex = 9999;
  popup.innerHTML = `<div style="cursor:pointer;padding:6px" id="act-play">Play now</div><div style="cursor:pointer;padding:6px" id="act-enqueue">Enqueue</div><div style="cursor:pointer;padding:6px" id="act-next">Play next</div>`;
  document.body.appendChild(popup);
  const rect = el.getBoundingClientRect();
  popup.style.left = (rect.right + 6) + 'px';
  popup.style.top = (rect.top) + 'px';
  const remove = () => popup.remove();
  popup.querySelector('#act-play').onclick = () => { remove(); play(zipUrl, idx); };
  popup.querySelector('#act-enqueue').onclick = () => { remove(); enqueue(zipUrl, idx); };
  popup.querySelector('#act-next').onclick = () => { remove(); state.queue.splice(1, 0, { album: zipUrl, index: idx }); renderQueue(); };
  setTimeout(() => window.addEventListener('click', remove, { once: true }), 20);
}

// small helpers expected to be provided (play/enqueue) by player module or main scope
function hookPlayers(hPlay, hEnqueue) { play = hPlay; enqueue = hEnqueue; }

function highlightActive() {
  const { tracklistEl } = getDom();
  const children = Array.from(tracklistEl.querySelectorAll('.track'));
  children.forEach((el, i) => el.classList.toggle('active', i === state.currentIndex));
}
