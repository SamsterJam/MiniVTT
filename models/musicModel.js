// models/musicModel.js
const path = require('path');
const fs = require('fs').promises;

const MUSIC_DIR = path.join(__dirname, '..', 'public', 'music');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);
const DEFAULT_VOLUME = 0.125; // what the DM's slider sits at when it is halfway

// Drop the upload's timestamp prefix and extension.
const displayName = (filename) =>
  path.basename(filename, path.extname(filename)).replace(/^\d+\s*[-_]?\s*/, '');

/**
 * Owns playback state, so late joiners are told rather than left guessing.
 * Position is the offset the current run started at, extrapolated on demand.
 */
class MusicModel {
  constructor() {
    this.tracks = new Map(); // trackId (= filename) -> track
    this.io = null;
  }

  attach(io) {
    this.io = io;
  }

  async load() {
    await fs.mkdir(MUSIC_DIR, { recursive: true });
    const files = await fs.readdir(MUSIC_DIR);

    for (const file of files) {
      if (AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase())) this.register(file);
    }
    console.log(`Loaded ${this.tracks.size} music track(s).`);
  }

  register(filename) {
    const track = {
      trackId: filename,
      name: displayName(filename),
      url: `/music/${encodeURIComponent(filename)}`,
      playing: false,
      volume: DEFAULT_VOLUME,
      position: 0, // seconds into the track when the current run began
      startedAt: null, // ms since epoch, or null while paused
    };
    this.tracks.set(track.trackId, track);
    return track;
  }

  /** Where a track has reached right now, in seconds. */
  positionOf(track) {
    if (!track.playing) return track.position;
    return track.position + (Date.now() - track.startedAt) / 1000;
  }

  /** All any client receives; state rather than events leaves nothing to miss. */
  state() {
    return [...this.tracks.values()].map((track) => ({
      trackId: track.trackId,
      name: track.name,
      url: track.url,
      playing: track.playing,
      volume: track.volume,
      position: this.positionOf(track),
    }));
  }

  broadcast() {
    this.io?.emit('musicState', this.state());
  }

  // --- Commands ---
  // Unknown ids are ignored, which also keeps them off the filesystem.

  add(filename) {
    const track = this.register(filename);
    this.broadcast();
    return track;
  }

  play(trackId) {
    const track = this.tracks.get(trackId);
    if (!track || track.playing) return;

    track.playing = true;
    track.startedAt = Date.now();
    this.broadcast();
  }

  pause(trackId) {
    const track = this.tracks.get(trackId);
    if (!track || !track.playing) return;

    track.position = this.positionOf(track);
    track.playing = false;
    track.startedAt = null;
    this.broadcast();
  }

  setVolume(trackId, volume) {
    const track = this.tracks.get(trackId);
    if (!track || typeof volume !== 'number' || !Number.isFinite(volume)) return;

    track.volume = Math.min(Math.max(volume, 0), 1);
    this.broadcast();
  }

  async remove(trackId) {
    const track = this.tracks.get(trackId);
    if (!track) return;

    this.tracks.delete(trackId);
    this.broadcast();

    try {
      await fs.unlink(path.join(MUSIC_DIR, trackId));
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(`Failed to delete ${trackId}:`, err.message);
    }
  }
}

module.exports = new MusicModel();
