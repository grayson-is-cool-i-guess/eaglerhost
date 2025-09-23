// === IndexedDB setup ===
const DB_NAME = 'JuicyCache';
const DB_VERSION = 1;
let db;

const DB = {
  async getAlbumData(zipUrl) {
    const dbAlbum = await loadAlbumFromDb(zipUrl, null); // size can be optional
    return dbAlbum ? dbAlbum : null;
  },
  async saveAlbumData(zipUrl, size, albumData) {
    await saveAlbumToDb(zipUrl, size, albumData);
  }
};


function openDb() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('albums')) {
        const store = d.createObjectStore('albums', { keyPath: 'url' });
        store.createIndex('size', 'size', { unique: false });
      }
      if (!d.objectStoreNames.contains('state')) {
        d.createObjectStore('state', { keyPath: 'key' });
      }
    };
    request.onsuccess = e => { db = e.target.result; resolve(db); };
    request.onerror = e => reject(e.target.error);
  });
}

function saveAlbumToDb(zipUrl, size, albumData) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('albums', 'readwrite');
    tx.objectStore('albums').put({ url: zipUrl, size, albumData });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  }));
}

function loadAlbumFromDb(zipUrl, size) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('albums', 'readonly');
    const req = tx.objectStore('albums').get(zipUrl);
    req.onsuccess = e => {
      const result = e.target.result;
      if (result && result.size === size) resolve(result.albumData);
      else resolve(null);
    };
    req.onerror = e => reject(e.target.error);
  }));
}

function saveStateToDb(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  }));
}

function loadStateFromDb(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get(key);
    req.onsuccess = e => resolve(e.target.result?.value ?? null);
    req.onerror = e => reject(e.target.error);
  }));
}

// === Utility ===
function ensureBlobUrl(track) {
  if (!track) return null;
  if (typeof track.blobUrl === 'string' && track.blobUrl && track.blobUrl !== 'null') return track.blobUrl;
  if (track.blob instanceof Blob) {
    try {
      const url = URL.createObjectURL(track.blob);
      track.blobUrl = url;
      return url;
    } catch (e) {
      console.warn('ensureBlobUrl failed for', track.filename, e);
      track.blobUrl = null;
      return null;
    }
  }
  return null;
}

// === Image resize worker ===
async function resizeImageWorker(blob, scale = 0.5) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([`
      self.onmessage = async e => {
        const { blob, scale } = e.data;
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width*scale, bitmap.height*scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
        self.postMessage(resizedBlob);
      };
    `], { type: 'text/javascript' })));
    worker.onmessage = e => resolve(e.data);
    worker.onerror = reject;
    worker.postMessage({ blob, scale });
  });
}

// === fflate worker unzip ===
function extractZipFflate(zipBlob) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([`
      importScripts('./js/fflate.js');

      self.onmessage = async e => {
        try {
          const blob = e.data.zipBlob;
          const reader = new FileReader();
          reader.onload = () => {
            const data = new Uint8Array(reader.result);
            const tracks = [];
            let art = null;
            fflate.unzip(data, {
              filter: () => true,
              consume: (name, fileData) => {
                const b = new Blob([fileData]);
                if (/cover|art/i.test(name)) art = b;
                else tracks.push({ filename: name, blob: b });
              }
            });
            self.postMessage({ tracks, art });
          };
          reader.onerror = e => self.postMessage({ error: e.message });
          reader.readAsArrayBuffer(blob);
        } catch(err) { self.postMessage({ error: err.message }); }
      };
    `], { type: 'text/javascript' })));
    worker.onmessage = e => {
      if (e.data.error) reject(e.data.error);
      else resolve(e.data);
    };
    worker.onerror = reject;
    worker.postMessage({ zipBlob });
  });
}

// === Fetch & Cache Album ===
async function fetchAlbum(zipUrl) {
  if (state.library[zipUrl]) return state.library[zipUrl];

  const response = await fetch(zipUrl);
  const blob = await response.blob();
  const sizeKb = Math.round(blob.size / 1024);

  const cached = await loadAlbumFromDb(zipUrl, sizeKb);
  if (cached) {
    cached.tracks.forEach(t => ensureBlobUrl(t));
    state.library[zipUrl] = cached;
    return cached;
  }

  const albumData = await extractZipFflate(blob);

  if (albumData.art instanceof Blob) {
    try {
      const resized = await resizeImageWorker(albumData.art, 0.5);
      albumData.art = URL.createObjectURL(resized);
    } catch(e){ console.warn(e); }
  }

  if (albumData.tracks.length > 0) ensureBlobUrl(albumData.tracks[0]);

  state.library[zipUrl] = albumData;
  await saveAlbumToDb(zipUrl, sizeKb, albumData);
  return albumData;
}

// === Preload Albums Parallel ===
async function preloadAlbums(zipUrls) {
  const promises = zipUrls.map(url => fetchAlbum(url));
  await Promise.allSettled(promises);
}

// === Play Track ===
async function playCached(zipUrl, idx) {
  const album = state.library[zipUrl] || await fetchAlbum(zipUrl);
  if (!album) return;

  state.currentAlbum = zipUrl;
  state.currentIndex = idx;

  const t = album.tracks[idx];
  ensureBlobUrl(t);

  const { audio, coverEl, nowTitle, nowSub, durationEl } = getDom();
  audio.src = t.blobUrl || t.blob;
  audio.currentTime = 0;
  audio.load();
  try { await audio.play(); } catch(e){}

  nowTitle.textContent = t.title || t.filename.split('/').pop().replace(/\.[^.]+$/, '');
  nowSub.textContent = `${t.artist || ''} • ${album.displayName}`;
  const art = album.art || t.picture;
  coverEl.innerHTML = '';
  const img = document.createElement('img');
  img.src = art || placeholder(album.displayName);
  coverEl.appendChild(img);

  highlightActive();
  if (t.duration) durationEl.textContent = fmt(t.duration);
  else loadTrackMetadata(t, zipUrl, idx).then(d => {
    durationEl.textContent = fmt(d);
    updateTrackRow(idx, t);
  }).catch(() => {});

  // Preload next track
  const nextIndex = (idx + 1) % album.tracks.length;
  if (album.tracks[nextIndex]) ensureBlobUrl(album.tracks[nextIndex]);
}

// === Play wrapper ===
async function play(zipUrl, idx) {
  playCached(zipUrl, idx);
}

// === Queue ===
function enqueue(zipUrl, index) {
  state.queue.push({ album: zipUrl, index });
  renderQueue();
}

// === Shuffle Helper ===
function makeShuffle(n) {
  state.shuffleOrder = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.shuffleOrder[i], state.shuffleOrder[j]] = [state.shuffleOrder[j], state.shuffleOrder[i]];
  }
}

// === Auto-Save Player State Every 5s ===
function autoSavePlayerState() {
  const { audio } = getDom();
  saveStateToDb('player', {
    currentAlbum: state.currentAlbum,
    currentIndex: state.currentIndex,
    volume: audio.volume,
    queue: state.queue,
    repeatMode: state.repeatMode,
    shuffled: state.shuffled,
    currentTime: audio.currentTime,
  }).catch(console.warn);
}
setInterval(autoSavePlayerState, 5000);

// === Restore Player State ===
async function restorePlayerState() {
  const saved = await loadStateFromDb('player');
  if (!saved) return;

  state.currentAlbum = saved.currentAlbum;
  state.currentIndex = saved.currentIndex;
  state.queue = saved.queue || [];
  state.repeatMode = saved.repeatMode || 0;
  state.shuffled = saved.shuffled || false;

  const { audio, volume } = getDom();
  audio.volume = saved.volume ?? 1;

  if (saved.currentAlbum != null && saved.currentIndex != null) {
    const album = state.library[saved.currentAlbum] || await fetchAlbum(saved.currentAlbum);
    const track = album.tracks[saved.currentIndex];
    ensureBlobUrl(track);
    audio.src = track.blobUrl;
    audio.currentTime = saved.currentTime || 0;
  }
}

// === Setup Audio Handlers ===
function setupAudioHandlers() {
  const { audio, playBtn, prevBtn, nextBtn, seek, currentTimeEl, durationEl, volume, shuffleBtn, repeatBtn, btnRefresh, searchInput, clearQueueBtn } = getDom();

  audio.addEventListener('play', () => playBtn.textContent = 'Pause');
  audio.addEventListener('pause', () => playBtn.textContent = 'Play');
  audio.addEventListener('timeupdate', () => {
    currentTimeEl.textContent = fmt(audio.currentTime);
    if (audio.duration) durationEl.textContent = fmt(audio.duration);
    if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
  });
  audio.addEventListener('ended', () => {
    if (state.repeatMode === 1) { audio.currentTime = 0; audio.play(); return; }
    if (state.queue.length > 0) {
      const next = state.queue.shift();
      renderQueue();
      playCached(next.album, next.index);
      return;
    }
    const album = state.library[state.currentAlbum];
    if (!album) return;
    let nextIndex = state.currentIndex + 1;
    if (state.shuffled) {
      if (state.shuffleOrder.length === 0) makeShuffle(album.tracks.length);
      nextIndex = state.shuffleOrder.shift();
    }
    if (nextIndex >= album.tracks.length) {
      if (state.repeatMode === 2) nextIndex = 0; else { audio.pause(); return; }
    }
    playCached(state.currentAlbum, nextIndex);
  });

  playBtn.onclick = () => { if (audio.paused) audio.play(); else audio.pause(); };
  prevBtn.onclick = () => {
    if (audio.currentTime > 3) { audio.currentTime = 0; }
    else {
      const album = state.library[state.currentAlbum];
      if (!album) return;
      state.currentIndex = (state.currentIndex - 1 + album.tracks.length) % album.tracks.length;
      playCached(state.currentAlbum, state.currentIndex);
    }
  };
  nextBtn.onclick = () => {
    if (state.queue.length > 0) {
      const next = state.queue.shift();
      renderQueue();
      playCached(next.album, next.index);
      return;
    }
    const album = state.library[state.currentAlbum];
    if (!album) return;
    if (state.shuffled) {
      if (state.shuffleOrder.length === 0) makeShuffle(album.tracks.length);
      const nextIndex = state.shuffleOrder.shift();
      playCached(state.currentAlbum, nextIndex);
    } else {
      let ni = state.currentIndex + 1;
      if (ni >= album.tracks.length) {
        if (state.repeatMode === 2) ni = 0; else { audio.pause(); return; }
      }
      playCached(state.currentAlbum, ni);
    }
  };

  seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; });
  volume.addEventListener('input', () => audio.volume = Number(volume.value));

  shuffleBtn.onclick = () => {
    state.shuffled = !state.shuffled;
    shuffleBtn.style.opacity = state.shuffled ? '1' : '0.6';
    if (state.shuffled) makeShuffle((state.library[state.currentAlbum]?.tracks || []).length);
  };

  repeatBtn.onclick = () => {
    state.repeatMode = (state.repeatMode + 1) % 3;
    repeatBtn.textContent = state.repeatMode === 0 ? 'Repeat [Off]' : state.repeatMode === 1 ? 'Repeat [This Song]' : 'Repeat [This Album]';
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (audio.paused) audio.play(); else audio.pause(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); nextBtn.click(); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); prevBtn.click(); }
  });

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (window._renderAlbumList) window._renderAlbumList(val);
  });

  btnRefresh.onclick = () => { if (window._loadManifest) window._loadManifest(); };
  clearQueueBtn.onclick = () => { state.queue = []; renderQueue(); };
}
