// public/js/musicPlayer.js

// Below this, correcting is inaudible and only risks a stutter.
const SEEK_TOLERANCE = 1.5;

// Audio elements drift; positions are extrapolated locally, so this is free.
const RESYNC_INTERVAL = 30000;

/** Keeps audio elements matching the server's music state. Used by both pages. */
export class MusicPlayer {
  constructor() {
    this.elements = new Map(); // trackId -> HTMLAudioElement
    this.tracks = [];
    this.receivedAt = 0;
    // Browsers block audio until the page has been interacted with.
    this.enabled = false;

    setInterval(() => this.apply(), RESYNC_INTERVAL);
  }

  sync(tracks) {
    this.tracks = tracks;
    this.receivedAt = Date.now();
    this.apply();
  }

  enable() {
    this.enabled = true;
    this.apply();
  }

  /** Where the track is now, not where it was when the state was sent. */
  positionOf(track) {
    if (!track.playing) return track.position;
    return track.position + (Date.now() - this.receivedAt) / 1000;
  }

  apply() {
    for (const track of this.tracks) {
      const audio = this.elementFor(track);
      audio.volume = track.volume;
      this.seek(audio, track);

      if (track.playing) {
        if (this.enabled && audio.paused) {
          audio.play().catch((err) => console.error(`Could not play ${track.name}:`, err.message));
        }
      } else if (!audio.paused) {
        audio.pause();
      }
    }

    const live = new Set(this.tracks.map((track) => track.trackId));
    for (const [trackId, audio] of this.elements) {
      if (live.has(trackId)) continue;
      audio.pause();
      audio.src = '';
      this.elements.delete(trackId);
    }
  }

  elementFor(track) {
    let audio = this.elements.get(track.trackId);
    if (!audio) {
      audio = new Audio(track.url);
      audio.loop = true;
      this.elements.set(track.trackId, audio);
    }
    return audio;
  }

  /** Tracks loop, so the server's running total has to be wrapped to fit. */
  seek(audio, track) {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      // Recompute once metadata lands, so the wait counts.
      audio.addEventListener('loadedmetadata', () => this.seek(audio, track), { once: true });
      return;
    }

    const target = this.positionOf(track) % audio.duration;
    if (Math.abs(audio.currentTime - target) > SEEK_TOLERANCE) audio.currentTime = target;
  }
}
