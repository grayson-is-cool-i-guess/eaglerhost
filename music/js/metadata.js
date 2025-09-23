// metadata.js
// parsing and extracting metadata (uses jsmediatags if available)

const Metadata = { loadTrackMetadata, parseVorbisComments };

 async function loadTrackMetadata(track, zipUrl, index) {
  if (track._metaLoaded) return;
  track._metaLoaded = false;
  const album = state.library[zipUrl];

  try {
    // try jsmediatags if available
    if (window.jsmediatags && track.blob) {
      await new Promise((resolve, reject) => {
        jsmediatags.read(track.blob, {
          onSuccess: (tag) => {
            try {
              const tags = tag.tags || {};
              track.title = tags.title || track.title || '';
              track.artist = tags.artist || '';
              track.album = tags.album || album.displayName;

              if (tags.picture && tags.picture.data && !album.art) {
                let bin = "";
                for (let i = 0; i < tags.picture.data.length; i++) bin += String.fromCharCode(tags.picture.data[i]);
                const imageUrl = `data:${tags.picture.format};base64,${btoa(bin)}`;
                track.picture = imageUrl;
                album.art = imageUrl;
              }

              if (track.album && !album.displayNameFromMeta) {
                album.displayName = track.album;
                album.displayNameFromMeta = true;
              }

              loadDuration(track).then(d => {
                track.duration = d;
              }).catch(()=>{});

              track._metaLoaded = true;
              resolve();
            } catch (inner) { reject(inner); }
          },
          onError: (err) => { reject(err || new Error('jsmediatags unknown error')); }
        });
      });
      return;
    }
  } catch (err) {
    // fall through to Vorbis/FLAC parser
    const isTagFormat = err && (err.type === 'tagFormat' || (err.info && /no suitable/i.test(String(err.info))));
    if (!isTagFormat) {
      console.warn('jsmediatags error (non-tagFormat) for', track.filename, err);
    }
  }

  // Vorbis comments / METADATA_BLOCK_PICTURE fallback
  try {
    const parsed = await parseVorbisComments(track.blob);
    if (parsed) {
      track.title = parsed.tags.TITLE || parsed.tags.title || track.title || '';
      track.artist = parsed.tags.ARTIST || parsed.tags.artist || '';
      track.album = parsed.tags.ALBUM || parsed.tags.album || album.displayName;

      if (parsed.picture && !album.art) {
        const imgBlob = new Blob([parsed.picture.data], { type: parsed.picture.mime || 'image/jpeg' });
        const imageUrl = URL.createObjectURL(imgBlob);
        track.picture = imageUrl;
        album.art = imageUrl;
      }

      if (track.album && !album.displayNameFromMeta) {
        album.displayName = track.album;
        album.displayNameFromMeta = true;
      }

      loadDuration(track).then(d => { track.duration = d; }).catch(()=>{});
      track._metaLoaded = true;
      return;
    }
  } catch (pvErr) {
    console.warn('Vorbis fallback parse failed for', track.filename, pvErr);
  }

  // final fallbacks
  track.title = track.title || track.filename && track.filename.split('/').pop().replace(/\.[^.]+$/, '') || 'Unknown';
  track.artist = track.artist || '';
  track.album = track.album || album.displayName;
  loadDuration(track).then(d => { track.duration = d; }).catch(()=>{});
  track._metaLoaded = true;
}

// parseVorbisComments accepts either a Blob or Uint8Array
 async function parseVorbisComments(blobOrBuf) {
  let arr;
  if (blobOrBuf instanceof Blob) {
    const sliceSize = Math.min(blobOrBuf.size, 256 * 1024);
    const buf = await blobOrBuf.slice(0, sliceSize).arrayBuffer();
    arr = new Uint8Array(buf);
  } else if (blobOrBuf instanceof Uint8Array) {
    arr = blobOrBuf;
  } else {
    return null;
  }

  const needle = new Uint8Array([0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]);
  let idx = -1;
  for (let i = 0; i <= arr.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) { if (arr[i + j] !== needle[j]) { ok = false; break; } }
    if (ok) { idx = i + needle.length; break; }
  }
  if (idx === -1) return null;

  let pos = idx;
  function readUInt32LE(offset) {
    return arr[offset] | (arr[offset + 1] << 8) | (arr[offset + 2] << 16) | (arr[offset + 3] << 24);
  }

  if (pos + 4 > arr.length) return null;
  const vendorLen = readUInt32LE(pos); pos += 4;
  if (pos + vendorLen > arr.length) return null;
  pos += vendorLen;
  if (pos + 4 > arr.length) return null;
  const userCount = readUInt32LE(pos); pos += 4;
  const tags = {};
  let picture = null;

  for (let i = 0; i < userCount; i++) {
    if (pos + 4 > arr.length) break;
    const len = readUInt32LE(pos); pos += 4;
    if (pos + len > arr.length) break;
    const bytes = arr.subarray(pos, pos + len);
    pos += len;
    const str = new TextDecoder('utf-8').decode(bytes);
    const eq = str.indexOf('=');
    if (eq !== -1) {
      const key = str.slice(0, eq).toUpperCase();
      const val = str.slice(eq + 1);
      if (!(key in tags)) tags[key] = val;
      if (key === 'METADATA_BLOCK_PICTURE' && val) {
        try {
          const picBytes = base64ToUint8Array(val.trim());
          const picParsed = parseFlacPictureBlock(picBytes);
          if (picParsed) picture = picParsed;
        } catch (e) {
          console.warn('Failed to decode METADATA_BLOCK_PICTURE', e);
        }
      }
    }
  }

  const normalized = {};
  for (const k in tags) normalized[k.toLowerCase()] = tags[k];
  return { tags: Object.assign({}, tags, normalized), picture };
}
