
/* One narration channel shared by the visit mixer and artifact mCubes. */
(() => {
  'use strict';

  function initAtlasAudio(artifacts) {
    const controls = document.querySelector('#atlasTourToggle');
    const status = document.querySelector('#atlasAudioStatus');
    const ids = artifacts.map(artifact => artifact.id);
    const titles = new Map(artifacts.map(artifact => [artifact.id, artifact.identity.title]));
    const theme = id => `${id}-theme-0${1 + Math.floor(Math.random() * 4)}`;
    const artifactTracks = id => [id, theme(id)];
    const newSession = (id, tracks) => ({id, tracks, index: 0, seconds: 0});

    function shuffle(previous) {
      const order = ids.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (order.length > 1 && order[0] === previous) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      try { sessionStorage.setItem('atlas.audio.first', order[0]); } catch {}
      return order.flatMap(artifactTracks);
    }

    let previous;
    try { previous = sessionStorage.getItem('atlas.audio.first'); } catch {}
    const tour = newSession('tour', ['intro', ...shuffle(previous)]);
    const sessions = new Map([[tour.id, tour]]);
    let active = null;

    function sync(root = document) {
      for (const button of root.querySelectorAll('[data-atlas-audio]')) {
        const id = button.dataset.atlasAudio;
        const playing = active?.session.id === id && active.wantsPlay;
        const label = id === 'tour' ? 'Atlas audio tour' : titles.get(id);
        const action = playing ? 'Pause' : 'Play';
        button.setAttribute('aria-label', `${action} ${label}`);
        button.title = `${action} ${label}`;
        button.dataset.audioState = playing ? 'playing' : 'idle';
      }
    }

    function disconnect() {
      if (!active) return;
      const slot = active;
      active = null;
      if (slot.media.readyState && Number.isFinite(slot.media.currentTime)) {
        slot.session.seconds = slot.media.currentTime;
      }
      slot.media.pause();
      slot.media.removeAttribute('src');
      slot.media.load();
      if (slot.blob) URL.revokeObjectURL(slot.blob);
    }

    function pause(slot) {
      slot.wantsPlay = false;
      slot.attempt++;
      slot.media.pause();
      sync();
    }

    function advance(slot) {
      if (active !== slot) return;
      const session = slot.session;
      disconnect();
      session.seconds = 0;
      session.index++;
      if (session.index === session.tracks.length) {
        session.index = 0;
        if (session !== tour) {
          sessions.delete(session.id);
          status.textContent = `Finished ${titles.get(session.id)}.`;
          sync();
          return;
        }
        const last = session.tracks.at(-1).slice(0, 6);
        session.tracks = shuffle(last);
      }
      play(connect(session));
    }

    function connect(session) {
      const track = session.tracks[session.index];
      const media = new Audio();
      const slot = {session, media, blob: '', wantsPlay: false, attempt: 0};
      active = slot;
      const embedded = document.getElementById(`atlas-audio-${track}`);
      if (embedded) {
        const bytes = Uint8Array.from(atob(embedded.textContent), character => character.charCodeAt(0));
        slot.blob = URL.createObjectURL(new Blob([bytes], {type: 'audio/mpeg'}));
      }
      media.preload = 'metadata';
      media.addEventListener('loadedmetadata', () => {
        if (active === slot && session.seconds > 0) {
          media.currentTime = Math.min(session.seconds, media.duration);
        }
      });
      media.addEventListener('ended', () => advance(slot));
      media.addEventListener('pause', () => {
        if (active === slot && !media.ended && media.paused) {
          slot.wantsPlay = false;
          sync();
        }
      });
      media.addEventListener('error', () => {
        if (active !== slot) return;
        disconnect();
        status.textContent = 'The recording could not load. Press Play to retry.';
        sync();
      });
      media.src = slot.blob || `audio/${track}.mp3`;
      return slot;
    }

    function play(slot) {
      const attempt = ++slot.attempt;
      slot.wantsPlay = true;
      sync();
      slot.media.play().then(() => {
        if (active !== slot || attempt !== slot.attempt) return;
        status.textContent = slot.session === tour ? 'Atlas audio tour playing.' : `Playing ${titles.get(slot.session.id)}.`;
      }).catch(error => {
        if (active !== slot || attempt !== slot.attempt) return;
        slot.wantsPlay = false;
        status.textContent = error.name === 'NotAllowedError'
          ? 'Press Play to start the Atlas audio tour.'
          : 'Playback could not start. Press Play to retry.';
        sync();
      });
    }

    function toggle(id) {
      if (id !== tour.id && !titles.has(id)) return;
      if (active?.session.id === id) {
        if (active.wantsPlay) {
          pause(active);
          status.textContent = 'Audio paused.';
        } else {
          play(active);
        }
        return;
      }
      disconnect();
      if (!sessions.has(id)) sessions.set(id, newSession(id, artifactTracks(id)));
      play(connect(sessions.get(id)));
    }

    document.addEventListener('click', event => {
      const button = event.target.closest('[data-atlas-audio]');
      if (button) toggle(button.dataset.atlasAudio);
    });
    window.addEventListener('pagehide', () => {
      if (active) pause(active);
    });
    controls.hidden = false;
    play(connect(tour));
    return {sync};
  }

  window.initAtlasAudio = initAtlasAudio;
})();

