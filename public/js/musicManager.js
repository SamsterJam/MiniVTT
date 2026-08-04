// public/js/musicManager.js
import { play, pause, trash } from './icons.js';

// Perceived loudness follows a curve, so a linear slider needs bending first.
const VOLUME_CURVE = 3;
const DEFAULT_SLIDER = 50;
const toVolume = (slider) => (slider / 100) ** VOLUME_CURVE;

export class MusicManager {
  constructor(socket) {
    this.socket = socket;
    this.tracks = [];
    this.listElement = document.getElementById('music-list');
  }

  /** Load the tracks already on the server. */
  async loadTracks() {
    try {
      const response = await fetch('/musicList');
      const { success, tracks, message } = await response.json();
      if (!success) throw new Error(message);
      tracks.forEach((track) => this.addTrack(track));
    } catch (err) {
      console.error('Could not load the music list:', err.message);
    }
  }

  addTrack({ url, filename, name }) {
    // The upload filename is already unique and, unlike a generated id, it
    // stays the same across reloads -- so players never accumulate duplicates.
    if (this.tracks.some((track) => track.trackId === filename)) return;

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = toVolume(DEFAULT_SLIDER);

    this.tracks.push({
      trackId: filename,
      url,
      filename,
      name,
      audio,
      isPlaying: false,
      slider: DEFAULT_SLIDER,
    });
    this.render();
  }

  // --- Rendering ---
  // The list is rebuilt from state, so play/pause icons and slider positions
  // can never drift out of sync with what is actually playing.

  render() {
    this.listElement.replaceChildren(...this.tracks.map((track) => this.renderTrack(track)));
  }

  renderTrack(track) {
    const name = document.createElement('span');
    name.className = 'track-name';
    name.textContent = track.name;
    name.title = track.name;

    const playButton = document.createElement('button');
    playButton.className = 'play-pause-button';
    playButton.innerHTML = track.isPlaying ? pause : play;
    playButton.title = track.isPlaying ? 'Pause' : 'Play';
    playButton.addEventListener('click', () => this.togglePlayback(track));

    const volume = document.createElement('input');
    volume.type = 'range';
    volume.className = 'volume-slider';
    volume.min = 0;
    volume.max = 100;
    volume.value = track.slider;
    volume.title = 'Volume';
    volume.addEventListener('input', () => this.setVolume(track, Number(volume.value)));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = trash;
    deleteButton.title = 'Delete track';
    deleteButton.addEventListener('click', () => this.deleteTrack(track));

    const controls = document.createElement('div');
    controls.className = 'controls-container';
    controls.append(playButton, volume, deleteButton);

    const item = document.createElement('li');
    item.className = 'music-track-item';
    item.append(name, controls);
    return item;
  }

  // --- Playback ---

  togglePlayback(track) {
    if (track.isPlaying) this.pause(track);
    else this.play(track);
  }

  play(track) {
    track.audio.play().catch((err) => console.error('Could not play track:', err));
    track.isPlaying = true;
    this.socket.emit('playTrack', {
      trackId: track.trackId,
      musicUrl: track.url,
      currentTime: track.audio.currentTime,
      volume: track.audio.volume,
    });
    this.render();
  }

  pause(track) {
    track.audio.pause();
    track.isPlaying = false;
    this.socket.emit('pauseTrack', {
      trackId: track.trackId,
      currentTime: track.audio.currentTime,
    });
    this.render();
  }

  setVolume(track, slider) {
    track.slider = slider;
    track.audio.volume = toVolume(slider);
    this.socket.emit('setTrackVolume', { trackId: track.trackId, volume: track.audio.volume });
    // Deliberately no re-render: it would replace the slider mid-drag.
  }

  async deleteTrack(track) {
    if (!confirm(`Delete "${track.name}"?`)) return;

    try {
      const response = await fetch('/deleteMusic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: track.filename }),
      });
      const { success, message } = await response.json();
      if (!success) throw new Error(message);
    } catch (err) {
      console.error('Could not delete track:', err.message);
      alert('Failed to delete music track.');
      return;
    }

    track.audio.pause();
    track.audio.src = '';
    this.tracks = this.tracks.filter((candidate) => candidate !== track);
    this.render();
    this.socket.emit('deleteTrack', { trackId: track.trackId });
  }

  // --- Uploading ---

  /** Turn an element into a drop target that uploads the audio dropped on it. */
  attachDropTarget(element) {
    const setActive = (active) => element.classList.toggle('dragover', active);

    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      setActive(true);
    });
    element.addEventListener('dragleave', () => setActive(false));
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      setActive(false);
      this.uploadFiles(event.dataTransfer.files);
    });
  }

  async uploadFiles(files) {
    const audioFiles = [...files].filter((file) => file.type.startsWith('audio/'));
    if (audioFiles.length !== files.length) alert('Only audio files can be added as music.');

    for (const file of audioFiles) {
      const body = new FormData();
      body.append('music', file);

      try {
        const response = await fetch('/uploadMusic', { method: 'POST', body });
        const { success, track, message } = await response.json();
        if (!success) throw new Error(message);

        this.addTrack(track);
        this.socket.emit('addTrack', {
          trackId: track.filename,
          musicUrl: track.url,
          name: track.name,
        });
      } catch (err) {
        console.error(`Could not upload ${file.name}:`, err.message);
        alert(`Failed to upload "${file.name}".`);
      }
    }
  }
}
