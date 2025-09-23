// storage.js
// Simple IndexedDB wrapper for Juicy player.
// stores:
//  - albums (key = zipUrl) => { zipUrl, size, displayName, tracks: [{filename,title,artist,album,duration}], art: Blob }
//  - app (key = string) => { key, value }

const DB = (function () {
  const DB_NAME = 'juicy-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains('albums')) {
          idb.createObjectStore('albums', { keyPath: 'zipUrl' });
        }
        if (!idb.objectStoreNames.contains('app')) {
          idb.createObjectStore('app', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function txn(storeName, mode = 'readonly') {
    const idb = await open();
    const tx = idb.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { tx, store };
  }

  return {
    async saveAlbumData(zipUrl, size, albumMeta) {
      // albumMeta = { displayName, tracks: [{filename,title,artist,album,duration}], artBlob (optional) }
      try {
        const { store, tx } = await txn('albums', 'readwrite');
        const record = Object.assign({}, albumMeta, { zipUrl, size });
        // ensure artBlob is a Blob or null
        if (record.artBlob === undefined) record.artBlob = null;
        const req = store.put(record);
        return new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      } catch (e) { console.warn('saveAlbumData err', e); return false; }
    },

    async getAlbumData(zipUrl) {
      try {
        const { store } = await txn('albums', 'readonly');
        return new Promise((resolve, reject) => {
          const req = store.get(zipUrl);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } catch (e) { console.warn('getAlbumData err', e); return null; }
    },

    async deleteAlbumData(zipUrl) {
      try {
        const { store } = await txn('albums', 'readwrite');
        return new Promise((resolve, reject) => {
          const r = store.delete(zipUrl);
          r.onsuccess = () => resolve(true);
          r.onerror = () => reject(r.error);
        });
      } catch (e) { console.warn('deleteAlbumData err', e); return false; }
    },

    async saveAppState(key, value) {
      try {
        const { store } = await txn('app', 'readwrite');
        const req = store.put({ key, value });
        return new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      } catch (e) { console.warn('saveAppState err', e); return false; }
    },

    async getAppState(key) {
      try {
        const { store } = await txn('app', 'readonly');
        return new Promise((resolve, reject) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ? req.result.value : null);
          req.onerror = () => reject(req.error);
        });
      } catch (e) { console.warn('getAppState err', e); return null; }
    }
  };
})();
window.DB = DB;
