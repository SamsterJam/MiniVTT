// models/musicModel.js
const path = require('path');
const fs = require('fs').promises;
const Settings = require('./settingsModel');

const MUSIC_DIR = path.join(__dirname, '..', 'public', 'music');
const NAMES_FILE = path.join(__dirname, '..', 'data', 'musicNames.json');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);
const DEFAULT_VOLUME = 0.125; // what the DM's slider sits at when it is halfway
const MAX_NAME = 200;

// A tenth of the slider's travel, cubed the way musicManager bends it. Below
// that a track is being slipped in, not started.
const QUIET_VOLUME = 0.1 ** 3;

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
    this.names = {}; // trackId -> the name the DM chose, when they chose one
    this.io = null;
  }

  attach(io) {
    this.io = io;
  }

  async load() {
    await fs.mkdir(MUSIC_DIR, { recursive: true });
    await this.loadNames();

    const files = await fs.readdir(MUSIC_DIR);
    for (const file of files) {
      if (AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase())) this.register(file);
    }

    // Forget names whose file has gone, so the store cannot grow forever.
    const stale = Object.keys(this.names).filter((trackId) => !this.tracks.has(trackId));
    if (stale.length > 0) {
      for (const trackId of stale) delete this.names[trackId];
      await this.saveNames();
    }

    console.log(`Loaded ${this.tracks.size} music track(s).`);
  }

  // --- Chosen names ---
  // The filename is the track's id and its URL, so renaming stores a label
  // rather than moving the file and breaking both.

  async loadNames() {
    try {
      const parsed = JSON.parse(await fs.readFile(NAMES_FILE, 'utf8'));
      this.names = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      // No file yet is the ordinary first run; anything else is a fault.
      if (err.code !== 'ENOENT') console.error(`Could not read track names: ${err.message}`);
      this.names = {};
    }
  }

  async saveNames() {
    try {
      await fs.mkdir(path.dirname(NAMES_FILE), { recursive: true });
      await fs.writeFile(NAMES_FILE, JSON.stringify(this.names, null, 2));
    } catch (err) {
      console.error(`Could not save track names: ${err.message}`);
    }
  }

  register(filename) {
    const track = {
      trackId: filename,
      name: this.names[filename] ?? displayName(filename),
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

    // Only a start is news; every other broadcast is bookkeeping.
    if (track.volume >= QUIET_VOLUME) Settings.announce('music', track.name);
  }

  pause(trackId) {
    const track = this.tracks.get(trackId);
    if (!track || !track.playing) return;

    track.position = this.positionOf(track);
    track.playing = false;
    track.startedAt = null;
    this.broadcast();
  }

  rename(trackId, name) {
    const track = this.tracks.get(trackId);
    const chosen = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) : '';
    if (!track || !chosen || chosen === track.name) return;

    track.name = chosen;
    this.names[trackId] = chosen;
    this.broadcast();
    this.saveNames();
  }

  setVolume(trackId, volume) {
    const track = this.tracks.get(trackId);
    if (!track || typeof volume !== 'number' || !Number.isFinite(volume)) return;

    track.volume = Math.min(Math.max(volume, 0), 1);
    this.broadcast();
  }

  /**
   * Reorder the list. The Map's insertion order is the list order, so this
   * rebuilds it; unmentioned ids keep their place at the end.
   */
  reorder(trackOrder) {
    if (!Array.isArray(trackOrder)) return;

    const ordered = new Map();
    for (const trackId of trackOrder) {
      const track = this.tracks.get(trackId);
      if (track) ordered.set(trackId, track);
    }
    for (const [trackId, track] of this.tracks) {
      if (!ordered.has(trackId)) ordered.set(trackId, track);
    }

    this.tracks = ordered;
    this.broadcast();
  }

  async remove(trackId) {
    const track = this.tracks.get(trackId);
    if (!track) return;

    this.tracks.delete(trackId);
    this.broadcast();

    if (trackId in this.names) {
      delete this.names[trackId];
      await this.saveNames();
    }

    try {
      await fs.unlink(path.join(MUSIC_DIR, trackId));
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(`Failed to delete ${trackId}:`, err.message);
    }
  }
}

module.exports = new MusicModel();
