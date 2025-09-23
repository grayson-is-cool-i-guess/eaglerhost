// utils.js
// small utilities used across modules

const Utils = { fmt, titleFromFilename, placeholder, base64ToUint8Array, parseFlacPictureBlock, loadDuration, resizeImage };

function fmt(t) {
  if (!isFinite(t)) return '0:00';
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  const m = Math.floor(t / 60);
  return `${m}:${s}`;
}

function titleFromFilename(fn) {
  if (!fn) return 'Unknown';
  fn = fn.split('/').pop();
  fn = fn.replace(/\.[^.]+$/, '');
  fn = fn.replace(/^\d+\s*[-._\s]*/, '');
  return fn;
}

function placeholder(text) {
  const c = document.createElement('canvas'); c.width = 400; c.height = 400;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, 400, 400);
  ctx.fillStyle = '#1db954'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText((text || 'Album').slice(0, 16), 200, 220);
  return c.toDataURL();
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function parseFlacPictureBlock(u8) {
  try {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = 0;
    function readUint32BE() { const v = dv.getUint32(p, false); p += 4; return v; }
    readUint32BE();
    const mimeLen = readUint32BE();
    if (p + mimeLen > u8.length) return null;
    const mime = new TextDecoder().decode(u8.subarray(p, p + mimeLen)); p += mimeLen;
    const descLen = readUint32BE();
    p += descLen;
    readUint32BE(); readUint32BE(); readUint32BE(); readUint32BE();
    const dataLen = readUint32BE();
    if (p + dataLen > u8.length) return null;
    const data = u8.subarray(p, p + dataLen);
    return { mime, data };
  } catch (e) {
    console.warn('parseFlacPictureBlock failed', e);
    return null;
  }
}

async function loadDuration(track) {
  if (track.duration) return track.duration;
  return new Promise((resolve, reject) => {
    const tmp = document.createElement('audio');
    tmp.preload = 'metadata';
    tmp.src = track.blobUrl;
    const clean = () => { tmp.src = ''; tmp.remove(); };
    tmp.addEventListener('loadedmetadata', () => {
      const d = tmp.duration;
      clean();
      if (isFinite(d)) resolve(track.duration = d); else reject();
    });
    tmp.addEventListener('error', () => { clean(); reject(); });
  });
}

async function resizeImage(blob, format) {
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await new Promise((resolve) => { img.onload = resolve; });
  const width = img.width;
  const height = img.height;
  const newWidth = Math.floor(width / 2);
  const newHeight = Math.floor(height / 2);
  if (newWidth <= 0 || newHeight <= 0) return URL.createObjectURL(blob);
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  const quality = 0.5;
  const mime = format.includes('png') ? 'image/png' : 'image/jpeg';
  return new Promise((resolve) => {
    canvas.toBlob((resizedBlob) => {
      resolve(URL.createObjectURL(resizedBlob));
    }, mime, quality);
  });
}
