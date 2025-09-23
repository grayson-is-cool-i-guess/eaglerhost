// main.js
// entry point: initialize DOM, hook modules, wire cross-module callbacks and start
document.addEventListener('DOMContentLoaded', async () => {
  initDom();
  const DOM = getDom();

  // wire UI hooks
  UI.hookPlayers(play, enqueue);

  // expose renderAlbumList for player/search to call easily
  window._renderAlbumList = (q = '') => UI.renderAlbumList(q);

  // expose loadManifest with appropriate render/prefetch callbacks
  window._loadManifest = () => loadManifest(
    () => UI.renderAlbumList(),
    () => prefetchAllAlbums(
      () => UI.renderAlbumList(DOM.searchInput.value || ''),
      (zipUrl, pic) => UI.updateAlbumThumb(zipUrl, pic),
      DOM.coverEl,
      DOM.searchInput.value || ''
    )
  );

  // wire functions used by zip/ui that are out of module scope
  window.openAlbum = async (zipUrl) => {
    const album = state.library[zipUrl];
    const disp = album.displayName;
    DOM.coverEl.innerHTML = '';
    const coverImg = document.createElement('img');
    coverImg.src = album.art || Utils.placeholder(disp);
    DOM.coverEl.appendChild(coverImg);
    DOM.nowTitle.textContent = disp;
    DOM.nowSub.textContent = `${album.tracks.length || 'Loading'} tracks`;
    UI.renderTracklist(zipUrl);

    if (album._loaded) return;
    album._loaded = true;

    try {
      const resp = await fetch(zipUrl, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = await resp.arrayBuffer();
      fflate.unzip(new Uint8Array(buf), { worker: true }, async (err, files) => {
        if (err) {
          console.error('fflate unzip error', err);
          DOM.albumsEl.innerHTML = `<div class="muted">Failed to unpack ZIP for ${disp}</div>`;
          return;
        }
        album.tracks = Object.entries(files)
          .filter(([name]) => /\.(mp3|m4a|ogg|flac)$/i.test(name))
          .map(([filename, data]) => {
            const ext = filename.match(/\.(mp3|m4a|ogg|flac)$/i)?.[1]?.toLowerCase();
            const type = ext === 'mp3' ? 'audio/mpeg' :
                         ext === 'm4a' ? 'audio/mp4' :
                         ext === 'ogg' ? 'audio/ogg' :
                         ext === 'flac' ? 'audio/flac' : 'application/octet-stream';
            const blob = new Blob([data], { type });
            const blobUrl = URL.createObjectURL(blob);
            return {
              filename,
              blob,
              blobUrl,
              title: Utils.titleFromFilename(filename),
              artist: null,
              album: null,
              duration: null,
              picture: null,
              _metaLoaded: false
            };
          });

        UI.renderTracklist(zipUrl);
        DOM.nowSub.textContent = `${album.tracks.length} tracks`;

        let foundArt = false;
        for (let i = 0; i < album.tracks.length; i++) {
          const t = album.tracks[i];
          try {
            await Metadata.loadTrackMetadata(t, zipUrl, i).catch(() => {});
          } catch (e) {
            console.warn('Error awaiting metadata for', t.filename, e);
          }
          const art = album.art || t.picture;
          if (art) {
            album.art = art;
            UI.updateAlbumThumb(zipUrl, art);
            DOM.coverEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = art;
            DOM.coverEl.appendChild(img);
            foundArt = true;
            break;
          }
        }

        if (!foundArt) {
          const imageEntries = Object.keys(files).filter(n => /\.(jpe?g|png|webp|gif)$/i.test(n));
          if (imageEntries.length > 0) {
            const imageName = imageEntries[0];
            const data = files[imageName];
            const ext = imageName.split('.').pop().toLowerCase();
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
            const imgBlob = new Blob([data], { type: mime });
            const imgUrl = URL.createObjectURL(imgBlob);
            album.art = imgUrl;
            UI.updateAlbumThumb(zipUrl, imgUrl);
            if (state.currentAlbum === zipUrl) {
              DOM.coverEl.innerHTML = '';
              const img = document.createElement('img');
              img.src = imgUrl;
              DOM.coverEl.appendChild(img);
            }
            foundArt = true;
          }
        }

        for (let i = 0; i < album.tracks.length; i++) {
          const t = album.tracks[i];
          if (!t._metaLoaded) {
            Metadata.loadTrackMetadata(t, zipUrl, i).catch(() => {});
          }
        }
      });
    } catch (err) {
      console.error(`Failed to load ZIP for ${zipUrl}`, err);
      DOM.albumsEl.innerHTML = `<div class="muted">Failed to load ZIP for ${disp}</div>`;
    }
  };

  // wire play/enqueue into UI module
  UI.hookPlayers(window.openAlbum ? play : play, enqueue);

  // setup audio handlers and start manifest load
  setupAudioHandlers();
  window._loadManifest();
});
