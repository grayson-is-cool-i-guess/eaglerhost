// zip.js
// fetching/unzipping and manifest handling
 async function fetchAndUnzip(zipUrl) {
  return downloadLimit(async () => {
    const resp = await fetch(zipUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${zipUrl}`);
    const buf = await resp.arrayBuffer();
    return await new Promise((resolve, reject) => {
      try {
        fflate.unzip(new Uint8Array(buf), { worker: true }, (err, files) => {
          if (err) return reject(err);
          resolve(files);
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

 async function prefetchAllAlbums(renderAlbumList, updateAlbumThumb, coverEl, searchQuery = '') {
  const zipUrls = state.albumOrder.slice();
  const tasks = zipUrls.map(async (zipUrl) => {
    const album = state.library[zipUrl];
    if (!album) return;
    try {
      const files = await fetchAndUnzip(zipUrl);
      album.tracks = Object.entries(files)
        .filter(([name]) => /\.(mp3|m4a|ogg|flac)$/i.test(name))
        .map(([filename, data]) => {
          const ext = filename.match(/\.(mp3|m4a|ogg|flac)$/i)?.[1]?.toLowerCase();
          const type = ext === 'mp3' ? 'audio/mpeg' :
                       ext === 'm4a' ? 'audio/mp4' :
                       ext === 'ogg' ? 'audio/ogg' :
                       ext === 'flac' ? 'audio/flac' : 'application/octet-stream';
          const blob = new Blob([data], { type });
          return {
            filename,
            blob,
            blobUrl: null,
            title: titleFromFilename(filename),
            artist: null,
            album: null,
            duration: null,
            picture: null,
            _metaLoaded: false
          };
        });

      album._loaded = true;
      album.artIndex = Number.POSITIVE_INFINITY;
      renderAlbumList(searchQuery);

      let fallbackImageBlob = null;
      const imageEntries = Object.keys(files).filter(n => /\.(jpe?g|png|webp|gif)$/i.test(n));
      if (imageEntries.length > 0) {
        const imgName = imageEntries[0];
        const data = files[imgName];
        const ext = imgName.split('.').pop().toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        fallbackImageBlob = new Blob([data], { type: mime });
      }

      const metaPromises = [];
      for (let i = 0; i < album.tracks.length; i++) {
        const track = album.tracks[i];
        const p = metaLimit(async () => {
          await Promise.resolve(); // yield
          try {
            await loadTrackMetadata(track, zipUrl, i);
          } catch (e) {
            console.warn('track metadata parse error', track.filename, e);
          }
          const pic = track.picture;
          if (pic) {
            if (i < (album.artIndex || Number.POSITIVE_INFINITY)) {
              album.art = pic;
              album.artIndex = i;
              updateAlbumThumb(zipUrl, pic);
              if (coverEl && state.currentAlbum === zipUrl) {
                coverEl.innerHTML = '';
                const img = document.createElement('img');
                img.src = (typeof pic === 'string') ? pic : URL.createObjectURL(new Blob([pic.data || pic], { type: pic.mime || 'image/jpeg' }));
                coverEl.appendChild(img);
              }
            }
          }
        });
        metaPromises.push(p);
      }

      Promise.allSettled(metaPromises).then(() => {
        if (!album.art && fallbackImageBlob) {
          const imgUrl = URL.createObjectURL(fallbackImageBlob);
          album.art = imgUrl;
          album.artIndex = 9999;
          updateAlbumThumb(zipUrl, imgUrl);
          if (coverEl && state.currentAlbum === zipUrl) {
            coverEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = imgUrl;
            coverEl.appendChild(img);
          }
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('Failed to prefetch/unzip', zipUrl, err);
      album._loaded = true;
    }
  });

  await Promise.allSettled(tasks);
  renderAlbumList(searchQuery);
}

 function buildLibraryFromManifest(man) {
  state.library = {};
  state.albumOrder = [];
  const zips = man.zips || [];
  for (const zipUrl of zips) {
    if (!zipUrl.toLowerCase().endsWith('.zip')) continue;
    const albumName = zipUrlToAlbumName(zipUrl);
    state.library[zipUrl] = { tracks: [], art: null, _loaded: false, displayName: albumName, zipUrl, zipData: null, displayNameFromMeta: false };
    state.albumOrder.push(zipUrl);
  }
}

 function zipUrlToAlbumName(zipUrl) {
  const parts = zipUrl.split('/');
  const filename = decodeURIComponent(parts[parts.length - 1]);
  return filename.replace(/\.zip$/i, '').replace(/[-_]/g, ' ');
}

 async function loadManifest(renderAlbumList, prefetchAll) {
  try {
    const manifest = window.MANIFEST;
    if (!manifest || !Array.isArray(manifest.zips)) throw new Error('Invalid manifest');
    buildLibraryFromManifest(manifest);
    renderAlbumList();
    prefetchAll().catch(err => console.warn('prefetchAllAlbums error', err));
  } catch (err) {
    const albumsEl = document.getElementById('albums');
    albumsEl.innerHTML = `<div class="muted">Failed to load manifest — check the MANIFEST script in HTML</div>`;
    console.error(err);
  }
}