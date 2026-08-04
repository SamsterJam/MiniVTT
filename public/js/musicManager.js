// public/js/musicManager.js
import { play, pause, trash } from './icons.js';
import { throttle } from './utils.js';
import { MusicPlayer } from './musicPlayer.js';

// Perceived loudness follows a curve, so a linear slider needs bending first.
const VOLUME_CURVE = 3;
const toVolume = (slider) => (slider / 100) ** VOLUME_CURVE;
const toSlider = (volume) => Math.round(volume ** (1 / VOLUME_CURVE) * 100);

// Fast enough for a fade to sound continuous, slow enough not to flood.
const VOLUME_INTERVAL = 60;

export class MusicManager {
  constructor(socket) {
    this.socket = socket;
    this.player = new MusicPlayer();
    this.tracks = [];
    this.rows = new Map(); // trackId -> row
    this.listElement = document.getElementById('music-list');

    // Drawn from server state, so a reload or second tab shows what is playing.
    this.socket.on('musicState', (tracks) => {
      this.tracks = tracks;
      this.player.sync(tracks);
      this.render();
    });

    // Audio cannot start until the page is interacted with; any click will do.
    document.addEventListener('click', () => this.player.enable(), { once: true });
  }

  trackFor(trackId) {
    return this.tracks.find((track) => track.trackId === trackId);
  }

  // --- Rendering ---
  // Rows are patched, not rebuilt: a volume drag triggers state mid-drag, and
  // replacing the list would pull the slider out from under the pointer.

  render() {
    for (const [trackId, row] of this.rows) {
      if (this.trackFor(trackId)) continue;
      row.item.remove();
      this.rows.delete(trackId);
    }

    for (const track of this.tracks) {
      let row = this.rows.get(track.trackId);
      if (!row) {
        row = this.createRow(track.trackId);
        this.rows.set(track.trackId, row);
      }
      this.updateRow(row, track);
      this.listElement.appendChild(row.item); // also keeps the order right
    }
  }

  createRow(trackId) {
    const row = { trackId, adjusting: false };

    row.name = document.createElement('span');
    row.name.className = 'track-name';

    row.playButton = document.createElement('button');
    row.playButton.className = 'play-pause-button';
    row.playButton.addEventListener('click', () => {
      const playing = this.trackFor(trackId)?.playing;
      this.socket.emit(playing ? 'pauseTrack' : 'playTrack', { trackId });
    });

    row.slider = document.createElement('input');
    row.slider.type = 'range';
    row.slider.className = 'volume-slider';
    row.slider.min = 0;
    row.slider.max = 100;
    row.slider.title = 'Volume';

    const sendVolume = throttle(
      (volume) => this.socket.emit('setTrackVolume', { trackId, volume }),
      VOLUME_INTERVAL
    );

    row.slider.addEventListener('input', () => {
      row.adjusting = true;
      const volume = toVolume(Number(row.slider.value));

      // Local audio moves now; everyone else follows at the throttled rate.
      const audio = this.player.elements.get(trackId);
      if (audio) audio.volume = volume;
      sendVolume(volume);
    });
    row.slider.addEventListener('change', () => {
      row.adjusting = false;
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = trash;
    deleteButton.title = 'Delete track';
    deleteButton.addEventListener('click', () => {
      const name = this.trackFor(trackId)?.name ?? trackId;
      if (confirm(`Delete "${name}"?`)) this.socket.emit('deleteTrack', { trackId });
    });

    const controls = document.createElement('div');
    controls.className = 'controls-container';
    controls.append(row.playButton, row.slider, deleteButton);

    row.item = document.createElement('li');
    row.item.className = 'music-track-item';
    row.item.append(row.name, controls);
    return row;
  }

  updateRow(row, track) {
    row.name.textContent = track.name;
    row.name.title = track.name;
    row.playButton.innerHTML = track.playing ? pause : play;
    row.playButton.title = track.playing ? 'Pause' : 'Play';

    // Never fight a slider that is currently being moved.
    if (!row.adjusting) row.slider.value = toSlider(track.volume);
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
        // The server registers the track and announces it; nothing to do here.
        const response = await fetch('/uploadMusic', { method: 'POST', body });
        const { success, message } = await response.json();
        if (!success) throw new Error(message);
      } catch (err) {
        console.error(`Could not upload ${file.name}:`, err.message);
        alert(`Failed to upload "${file.name}".`);
      }
    }
  }
}
