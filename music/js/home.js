// home.js
// Renders a simple "Spotify-like" homepage into the main area.
// Assumes DOM has been initialized (initDom).

function createCard({ title, subtitle, artUrl, onClick }) {
  const c = document.createElement('div');
  c.className = 'home-card';
  c.style.cursor = 'pointer';
  const img = document.createElement('img');
  img.src = artUrl || Utils.placeholder(title);
  img.alt = title;
  img.className = 'home-card-art';
  const meta = document.createElement('div');
  meta.className = 'home-card-meta';
  meta.innerHTML = `<div class="home-card-title">${title}</div><div class="home-card-sub">${subtitle || ''}</div>`;
  c.appendChild(img);
  c.appendChild(meta);
  c.onclick = onClick;
  return c;
}

async function renderHome() {
  const DOM = getDom();
  const mainEl = document.querySelector('.main');
  if (!mainEl) return;

  // Ensure home container exists
  let home = document.getElementById('home');
  if (!home) {
    home = document.createElement('div');
    home.id = 'home';
    home.style.marginTop = '8px';
    home.className = 'home';
    // insert before Tracklist heading (we'll put it above tracklist)
    const tracklistHeading = Array.from(mainEl.querySelectorAll('.muted')).find(el => el.textContent === 'Tracklist');
    mainEl.insertBefore(home, tracklistHeading || mainEl.querySelector('#tracklist'));
  }
  home.innerHTML = '';

  // Load small appstate & recently played
  const appState = (await DB.getAppState('appState')) || {};
  const recently = appState.recentlyPlayed || []; // array of {album, index, ts}

  // Continue listening (current)
  const continueWrap = document.createElement('div');
  continueWrap.className = 'home-section';
  const h1 = document.createElement('div'); h1.className = 'section-title'; h1.textContent = 'Continue listening';
  continueWrap.appendChild(h1);
  const row = document.createElement('div'); row.className = 'home-row';

  if (state.currentAlbum && state.library[state.currentAlbum]) {
    const album = state.library[state.currentAlbum];
    const t = album.tracks[state.currentIndex] || {};
    const art = album.art || t.picture || Utils.placeholder(album.displayName);
    row.appendChild(createCard({
      title: t.title || album.displayName,
      subtitle: `${t.artist || ''} — ${album.displayName}`,
      artUrl: art,
      onClick: () => {
        if (state.currentAlbum) openAlbum(state.currentAlbum);
        play(state.currentAlbum, state.currentIndex);
      }
    }));
  } else {
    const sample = state.albumOrder.slice(0, 4);
    for (const z of sample) {
      const album = state.library[z];
      row.appendChild(createCard({
        title: album.displayName,
        subtitle: `${(album.tracks && album.tracks[0] && album.tracks[0].artist) || ''}`,
        artUrl: album.art || Utils.placeholder(album.displayName),
        onClick: () => openAlbum(z)
      }));
    }
  }

  continueWrap.appendChild(row);
  home.appendChild(continueWrap);

  // Recently played
  const recWrap = document.createElement('div');
  recWrap.className = 'home-section';
  const h2 = document.createElement('div'); h2.className = 'section-title'; h2.textContent = 'Recently played';
  recWrap.appendChild(h2);
  const recRow = document.createElement('div'); recRow.className = 'home-row';

  for (const item of recently.slice(0, 8)) {
    const album = state.library[item.album] || {};
    const t = (album.tracks && album.tracks[item.index]) || { filename: 'Unknown' };
    const art = album.art || t.picture || Utils.placeholder(album.displayName || 'Album');
    recRow.appendChild(createCard({
      title: t.title || titleFromFilename(t.filename) || album.displayName,
      subtitle: album.displayName,
      artUrl: art,
      onClick: () => {
        openAlbum(item.album);
        play(item.album, item.index);
      }
    }));
  }
  recWrap.appendChild(recRow);
  home.appendChild(recWrap);

  // Made for you: pick some albums from albumOrder
  const mfWrap = document.createElement('div');
  mfWrap.className = 'home-section';
  const h3 = document.createElement('div'); h3.className = 'section-title'; h3.textContent = 'Made for you';
  mfWrap.appendChild(h3);
  const mfRow = document.createElement('div'); mfRow.className = 'home-row';
  const picks = state.albumOrder.slice(0, 8);
  for (const z of picks) {
    const album = state.library[z];
    if (!album) continue;
    mfRow.appendChild(createCard({
      title: album.displayName,
      subtitle: `${(album.tracks && album.tracks[0] && album.tracks[0].artist) || ''}`,
      artUrl: album.art || Utils.placeholder(album.displayName),
      onClick: () => openAlbum(z)
    }));
  }
  mfWrap.appendChild(mfRow);
  home.appendChild(mfWrap);
}

function initHomeStyles() {
  if (document.getElementById('home-styles')) return;
  const s = document.createElement('style');
  s.id = 'home-styles';
  s.textContent = `
.home-section { margin: 12px 0; }
.section-title { font-weight:700; margin-bottom:8px; font-size:16px; }
.home-row { display:flex; gap:10px; overflow:auto; padding-bottom:8px; }
.home-card { width:160px; flex:0 0 160px; background:linear-gradient(180deg, rgba(255,255,255,0.01), transparent); border-radius:10px; padding:8px; display:flex; gap:8px; align-items:center; flex-direction:column; text-align:center; }
.home-card-art { width:140px; height:140px; border-radius:8px; object-fit:cover; background:#222; }
.home-card-meta { width:100%; }
.home-card-title { font-weight:700; font-size:14px; margin-top:6px; }
.home-card-sub { font-size:12px; color:var(--muted); margin-top:2px; }
  `;
  document.head.appendChild(s);
}

window.Home = { renderHome, initHomeStyles };

document.addEventListener('DOMContentLoaded', () => { initHomeStyles(); renderHome(); });

// also re-render home when app state changes
window.addEventListener('storageUpdated', () => {
  renderHome();
});
