let DOM = null;

function initDom() {
  DOM = {
    audio: document.getElementById('audio'),
    albumsEl: document.getElementById('albums'),
    tracklistEl: document.getElementById('tracklist'),
    coverEl: document.getElementById('cover'),
    nowTitle: document.getElementById('now-title'),
    nowSub: document.getElementById('now-sub'),
    playBtn: document.getElementById('play'),
    prevBtn: document.getElementById('prev'),
    nextBtn: document.getElementById('next'),
    seek: document.getElementById('seek'),
    currentTimeEl: document.getElementById('current'),
    durationEl: document.getElementById('duration'),
    volume: document.getElementById('volume'),
    searchInput: document.getElementById('search'),
    btnRefresh: document.getElementById('btn-refresh'),
    shuffleBtn: document.getElementById('shuffle'),
    repeatBtn: document.getElementById('repeat'),
    queueEl: document.getElementById('queue'),
    queueCountEl: document.getElementById('queue-count'),
    clearQueueBtn: document.getElementById('clear-queue')
  };
  return DOM;
}

function getDom() {
  return DOM;
}
