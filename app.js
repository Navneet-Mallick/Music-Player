import { saveSong, loadSongs, deleteSong } from './db.js';

// ─── Catalogue ────────────────────────────────────────────────────────────────
// Public domain tracks from archive.org (CC0 / expired copyright)
const CATALOGUE = [
  // ── Synth-generated originals (no file needed) ──
  {
    id: 0, title: "Midnight Drift",  artist: "GrooveBox Originals",
    genre: "Lo-Fi", duration: "∞",   color: "#1a2a3a", emoji: "🌙",
    synthStyle: "lofi",    playlist: ["chill","focus"],
  },
  {
    id: 1, title: "Neon Pulse",      artist: "GrooveBox Originals",
    genre: "Synthwave", duration: "∞", color: "#2a0a3a", emoji: "⚡",
    synthStyle: "synthwave", playlist: ["synthwave"],
  },
  {
    id: 2, title: "Deep Space",      artist: "GrooveBox Originals",
    genre: "Ambient", duration: "∞",  color: "#050a1a", emoji: "🚀",
    synthStyle: "ambient",  playlist: ["chill","focus"],
  },
  // ── Public Domain from Internet Archive ──
  {
    id: 3, title: "Gymnopédie No.1", artist: "Erik Satie",
    genre: "Classical", duration: "3:05", color: "#1a1a2e", emoji: "🎹",
    src: "https://archive.org/download/Gymnopedie/Gymnopedie_No1.mp3",
    playlist: ["chill","focus"],
  },
  {
    id: 4, title: "Clair de Lune",   artist: "Claude Debussy",
    genre: "Classical", duration: "5:00", color: "#0d1b2a", emoji: "🌙",
    src: "https://archive.org/download/ClairDeLune_755/ClairDeLune.mp3",
    playlist: ["chill","focus"],
  },
  {
    id: 5, title: "Moonlight Sonata", artist: "Beethoven",
    genre: "Classical", duration: "5:50", color: "#16213e", emoji: "🎼",
    src: "https://archive.org/download/MoonlightSonata_755/MoonlightSonata.mp3",
    playlist: ["focus"],
  },
  {
    id: 6, title: "Nocturne Op.9 No.2", artist: "Frédéric Chopin",
    genre: "Classical", duration: "4:30", color: "#0f3460", emoji: "🎵",
    src: "https://archive.org/download/NocturneOp9No2/NocturneOp9No2.mp3",
    playlist: ["chill","focus"],
  },
  {
    id: 7, title: "Für Elise",       artist: "Beethoven",
    genre: "Classical", duration: "2:55", color: "#1b1b2f", emoji: "🌸",
    src: "https://archive.org/download/FurElise_755/FurElise.mp3",
    playlist: ["chill"],
  },
];

// ─── Playlists ────────────────────────────────────────────────────────────────
const PLAYLISTS = [
  { id: "all",       name: "All Songs",   icon: "🎵" },
  { id: "liked",     name: "Liked Songs", icon: "💚" },
  { id: "chill",     name: "Chill Mix",   icon: "🌙" },
  { id: "synthwave", name: "Synthwave",   icon: "⚡" },
  { id: "focus",     name: "Focus",       icon: "🎯" },
  { id: "local",     name: "My Library",  icon: "📁" },
];

// ─── State ────────────────────────────────────────────────────────────────────
let songs          = CATALOGUE.map(s => ({ ...s, isLocal: false, src: s.src || null }));
let currentIndex   = -1;
let isPlaying      = false;
let isShuffle      = false;
let repeatMode     = 0;
let isMuted        = false;
let activePlaylist = "all";
let likedSongs     = new Set(JSON.parse(localStorage.getItem('gb_liked') || '[]'));
let shuffleOrder   = [];

// ─── Synth Engine (from reference) ───────────────────────────────────────────
let synthCtx = null, masterGain = null, synthNodes = [], chordTimer = null;
let activeSynthStyle = null;

const SYNTH_CHORDS = {
  lofi: [
    [220.00, 261.63, 329.63, 392.00],
    [196.00, 246.94, 293.66, 369.99],
    [174.61, 220.00, 261.63, 329.63],
    [164.81, 207.65, 246.94, 311.13],
  ],
  synthwave: [
    [82.41,  164.81, 246.94, 329.63],
    [87.31,  174.61, 261.63, 349.23],
    [73.42,  146.83, 220.00, 293.66],
    [98.00,  196.00, 293.66, 392.00],
  ],
  ambient: [
    [130.81, 164.81, 196.00, 261.63],
    [146.83, 174.61, 220.00, 293.66],
    [116.54, 155.56, 185.00, 233.08],
    [110.00, 138.59, 164.81, 220.00],
  ],
};
let chordIndex = 0;

function getSynthCtx() {
  if (!synthCtx) {
    synthCtx  = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = synthCtx.createGain();
    masterGain.gain.setValueAtTime(0, synthCtx.currentTime);
    masterGain.connect(synthCtx.destination);
  }
  return synthCtx;
}

function createPad(freq, style) {
  const ac = getSynthCtx();
  const osc1 = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc1.type = style === 'lofi' ? 'triangle' : style === 'synthwave' ? 'sawtooth' : 'sine';
  osc2.type = 'sine';
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 1.007;

  filter.type = 'lowpass';
  filter.frequency.value = style === 'lofi' ? 700 : style === 'synthwave' ? 1200 : 900;

  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.045, ac.currentTime + 1.8);

  osc1.connect(filter); osc2.connect(filter);
  filter.connect(gain); gain.connect(masterGain);
  osc1.start(); osc2.start();
  return { osc1, osc2, gain };
}

function playSynthChord(style) {
  const ac = getSynthCtx();
  const chords = SYNTH_CHORDS[style] || SYNTH_CHORDS.ambient;
  const freqs  = chords[chordIndex % chords.length];
  chordIndex++;

  // fade out old nodes
  synthNodes.forEach(n => {
    if (n.gain) {
      n.gain.gain.linearRampToValueAtTime(0, ac.currentTime + 2.5);
      setTimeout(() => { try { n.osc1?.stop(); n.osc2?.stop(); } catch(e){} }, 3000);
    }
  });
  synthNodes = freqs.map(f => createPad(f, style));

  const interval = style === 'synthwave' ? 3500 : style === 'lofi' ? 4000 : 6000;
  chordTimer = setTimeout(() => { if (activeSynthStyle) playSynthChord(style); }, interval);
}

function startSynth(style) {
  const ac = getSynthCtx();
  if (ac.state === 'suspended') ac.resume();
  activeSynthStyle = style;
  masterGain.gain.cancelScheduledValues(ac.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.72, ac.currentTime + 1.5);
  playSynthChord(style);
}

function stopSynth() {
  if (!synthCtx || !masterGain) return;
  activeSynthStyle = null;
  clearTimeout(chordTimer);
  masterGain.gain.cancelScheduledValues(synthCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, synthCtx.currentTime + 1.2);
  setTimeout(() => {
    synthNodes.forEach(n => { try { n.osc1?.stop(); n.osc2?.stop(); } catch(e){} });
    synthNodes = [];
  }, 1400);
}

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const audio           = document.getElementById('audio-player');
const songGrid        = document.getElementById('song-grid');
const playBtn         = document.getElementById('play-btn');
const prevBtn         = document.getElementById('prev-btn');
const nextBtn         = document.getElementById('next-btn');
const shuffleBtn      = document.getElementById('shuffle-btn');
const repeatBtn       = document.getElementById('repeat-btn');
const likeBtn         = document.getElementById('like-btn');
const muteBtn         = document.getElementById('mute-btn');
const queueBtn        = document.getElementById('queue-btn');
const closeQueue      = document.getElementById('close-queue');
const queuePanel      = document.getElementById('queue-panel');
const queueList       = document.getElementById('queue-list');
const progressBar     = document.getElementById('progress-bar');
const progressFill    = document.getElementById('progress-fill');
const progressThumb   = document.getElementById('progress-thumb');
const volumeBar       = document.getElementById('volume-bar');
const volumeFill      = document.getElementById('volume-fill');
const volumeThumb     = document.getElementById('volume-thumb');
const currentTimeEl   = document.getElementById('current-time');
const totalTimeEl     = document.getElementById('total-time');
const npTitle         = document.getElementById('np-title');
const npArtist        = document.getElementById('np-artist');
const npCover         = document.getElementById('np-cover');
const searchInput     = document.getElementById('search-input');
const localUpload     = document.getElementById('local-upload');
const playlistSidebar = document.getElementById('playlist-sidebar');
const mainTitle       = document.getElementById('main-title');

// ─── Boot ─────────────────────────────────────────────────────────────────────
audio.volume = 0.7;
setVolumeUI(0.7);
renderSidebarPlaylists();
renderGrid();
renderQueue();
showWelcomeScreen();

async function boot() {
  // Load IndexedDB saved songs
  try {
    const saved = await loadSongs();
    saved.forEach(row => songs.push({
      id: songs.length, dbId: row.id,
      title: row.title, artist: row.artist,
      genre: row.genre || 'Local', duration: '—',
      src: row.src, isLocal: true,
      color: row.color, emoji: row.emoji,
      playlist: ['local'],
    }));
    if (saved.length) { renderGrid(); renderQueue(); }
  } catch(e) { console.warn('IndexedDB:', e); }

  // Auto-play first synth track as welcome
  setTimeout(() => {
    dismissWelcome();
    playSong(0);
  }, 300);
}

// ─── Welcome ──────────────────────────────────────────────────────────────────
function showWelcomeScreen() {
  const o = document.createElement('div');
  o.id = 'welcome-overlay';
  o.innerHTML = `
    <div class="welcome-card">
      <div class="welcome-logo"><i class="fa-solid fa-music"></i></div>
      <h1>GrooveBox</h1>
      <p>Your personal music space</p>
      <button id="welcome-enter" class="welcome-btn">
        <i class="fa-solid fa-play"></i> Start Listening
      </button>
      <span class="welcome-sub">Synth originals · Public domain classics · Your uploads</span>
    </div>`;
  document.body.appendChild(o);
  document.getElementById('welcome-enter').addEventListener('click', () => {
    o.classList.add('fade-out');
    setTimeout(() => o.remove(), 500);
    boot();
  });
}
function dismissWelcome() {
  const o = document.getElementById('welcome-overlay');
  if (o) { o.classList.add('fade-out'); setTimeout(() => o.remove(), 500); }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, dur = 3000) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast show';
  clearTimeout(toastTimer);
  if (dur > 0) toastTimer = setTimeout(hideToast, dur);
}
function hideToast() {
  const t = document.getElementById('toast'); if (t) t.className = 'toast';
}

// ─── Playlist filtering ───────────────────────────────────────────────────────
function getPlaylistSongs() {
  switch (activePlaylist) {
    case 'liked': return songs.filter(s => likedSongs.has(s.id));
    case 'local': return songs.filter(s => s.isLocal);
    case 'all':   return songs;
    default:      return songs.filter(s => s.playlist?.includes(activePlaylist));
  }
}

// ─── Render Grid ──────────────────────────────────────────────────────────────
function renderGrid(q = '') {
  songGrid.innerHTML = '';
  let list = getPlaylistSongs();
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(s => s.title.toLowerCase().includes(lq) || s.artist.toLowerCase().includes(lq));
  }
  if (!list.length) {
    songGrid.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-music"></i>
      <p>${activePlaylist === 'liked' ? 'No liked songs yet — heart a track to save it here.' :
          activePlaylist === 'local' ? 'No local songs yet. Upload via the sidebar.' :
          'No songs match your search.'}</p></div>`;
    return;
  }
  const synth   = list.filter(s => s.synthStyle);
  const classic = list.filter(s => !s.synthStyle && !s.isLocal);
  const local   = list.filter(s => s.isLocal);
  if (synth.length)   appendSection('🎧 GrooveBox Originals', synth);
  if (classic.length) appendSection('🎼 Public Domain Classics', classic);
  if (local.length)   appendSection('📁 My Library', local);
}

function appendSection(title, list) {
  const sec  = document.createElement('div'); sec.className = 'grid-section';
  const head = document.createElement('h3');  head.className = 'grid-section-title'; head.textContent = title;
  const grid = document.createElement('div'); grid.className = 'song-grid-inner';
  list.forEach(s => grid.appendChild(makeSongCard(s)));
  sec.appendChild(head); sec.appendChild(grid); songGrid.appendChild(sec);
}

function makeSongCard(song) {
  const isActive = song.id === currentIndex;
  const isLiked  = likedSongs.has(song.id);
  const card = document.createElement('div');
  card.className = `song-card${isActive ? ' active' : ''}`;

  const playIcon = isActive && isPlaying ? 'fa-pause' : 'fa-play';
  card.innerHTML = `
    <div class="card-cover" style="background:${song.color}">
      <span class="cover-icon">${song.emoji}</span>
      <div class="card-play-overlay"><i class="fa-solid ${playIcon}"></i></div>
    </div>
    <div class="card-title">${song.title}</div>
    <div class="card-artist">${song.artist}</div>
    <div class="card-meta">${song.genre} · ${song.duration}</div>
    <div class="card-actions">
      <button class="card-like-btn${isLiked ? ' liked' : ''}" title="${isLiked ? 'Unlike' : 'Like'}">
        <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
      </button>
      ${song.isLocal ? `<button class="delete-btn" title="Remove"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>`;

  card.addEventListener('click', () => playSong(song.id));

  card.querySelector('.card-like-btn').addEventListener('click', e => {
    e.stopPropagation(); toggleLike(song.id); renderGrid(searchInput.value);
  });

  if (song.isLocal) {
    card.querySelector('.delete-btn').addEventListener('click', async e => {
      e.stopPropagation();
      if (song.dbId) { try { await deleteSong(song.dbId); } catch(err){} }
      if (currentIndex === song.id) resetPlayer();
      songs = songs.filter(s => s.id !== song.id);
      songs.forEach((s, i) => s.id = i);
      if (currentIndex >= songs.length) currentIndex = -1;
      renderGrid(searchInput.value); renderQueue();
      showToast('🗑️ Song removed', 1500);
    });
  }
  return card;
}
