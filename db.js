/**
 * db.js — IndexedDB wrapper for GrooveBox
 * Stores uploaded song files (as Blobs) + metadata so they survive page refresh.
 */

const DB_NAME    = 'groovebox';
const DB_VERSION = 1;
const STORE      = 'songs';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// Save a song (blob + metadata), returns the assigned id
async function saveSong({ title, artist, genre, blob, color, emoji }) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({ title, artist, genre, blob, color, emoji });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// Load all saved songs, returns array with object URL for each blob
async function loadSongs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = e => {
      const rows = e.target.result.map(row => ({
        ...row,
        src: URL.createObjectURL(row.blob),
        isLocal: true,
      }));
      resolve(rows);
    };
    req.onerror = e => reject(e.target.error);
  });
}

// Delete a song by its db id
async function deleteSong(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}
