const state = {
  library: {},     
  albumOrder: [],
  currentAlbum: null,
  currentIndex: 0,
  queue: [],
  repeatMode: 0,
  shuffled: false,
  shuffleOrder: []
};

const CORES = Math.max(2, navigator.hardwareConcurrency || 4);
const MAX_CONCURRENT_DOWNLOADS = Math.min(4, Math.max(1, Math.floor(CORES / 2)));
const MAX_CONCURRENT_METADATA = Math.max(2, CORES - 1);

function pLimit(max) {
  let active = 0;
  const q = [];
  const next = () => {
    if (active >= max || q.length === 0) return;
    active++;
    const { fn, resolve, reject } = q.shift();
    fn().then(res => { resolve(res); active--; next(); }).catch(err => { reject(err); active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => {
    q.push({ fn, resolve, reject });
    next();
  });
}

const downloadLimit = pLimit(MAX_CONCURRENT_DOWNLOADS);
const metaLimit = pLimit(MAX_CONCURRENT_METADATA);
