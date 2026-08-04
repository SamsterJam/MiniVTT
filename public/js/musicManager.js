// public/js/musicManager.js
import { play, pause, grip } from './icons.js';
import { throttle } from './utils.js';
import { MusicPlayer } from './musicPlayer.js';
import { confirmDialog, contextMenu, toast } from './ui.js';

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

    // Grip only: the rest of the row is a slider and a button.
    this.sortable = new Sortable(this.listElement, {
      animation: 150,
      handle: '.track-handle',
      onEnd: () => {
        const items = this.listElement.querySelectorAll('.music-track-item');
        const trackOrder = [...items].map((item) => item.dataset.trackId);
        this.socket.emit('reorderTracks', { trackOrder });
      },
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

    this.tracks.forEach((track, index) => {
      let row = this.rows.get(track.trackId);
      if (!row) {
        row = this.createRow(track.trackId);
        this.rows.set(track.trackId, row);
      }
      this.updateRow(row, track);

      // Only move a row that is out of place: re-inserting one cancels a drag
      // on its slider, and blurs a rename in progress.
      const occupant = this.listElement.children[index];
      if (occupant !== row.item && !row.editing) {
        this.listElement.insertBefore(row.item, occupant ?? null);
      }
    });
  }

  createRow(trackId) {
    const row = { trackId };

    row.name = document.createElement('span');
    row.name.className = 'track-name';
    row.name.addEventListener('dblclick', () => this.beginRename(trackId));
    row.name.addEventListener('blur', () => this.endRename(row, true));
    row.name.addEventListener('keydown', (event) => {
      // Enter commits through the blur handler; Escape puts the old name back.
      if (event.key === 'Enter') {
        event.preventDefault();
        row.name.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.endRename(row, false);
        row.name.blur();
      }
    });

    row.playButton = document.createElement('button');
    row.playButton.className = 'btn icon play-pause-button';
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

    // A drag owns the track's volume until it ends: local audio moves now and
    // everyone else follows at the throttled rate.
    row.slider.addEventListener('input', () => {
      this.player.holding.add(trackId);

      const volume = toVolume(Number(row.slider.value));
      const audio = this.player.elements.get(trackId);
      if (audio) audio.volume = volume;

      this.paintSlider(row);
      sendVolume(volume);
    });
    row.slider.addEventListener('change', () => this.player.holding.delete(trackId));

    row.handle = document.createElement('span');
    row.handle.className = 'track-handle';
    row.handle.innerHTML = grip;
    row.handle.title = 'Drag to reorder';

    const body = document.createElement('div');
    body.className = 'track-body';
    body.append(row.name, row.slider);

    row.item = document.createElement('li');
    row.item.className = 'music-track-item';
    row.item.dataset.trackId = trackId;
    row.item.append(row.playButton, body, row.handle);

    // Occasional and unrecoverable actions; neither earns space on every row.
    row.item.addEventListener('contextmenu', (event) =>
      contextMenu(event, [
        { label: 'Rename', onSelect: () => this.beginRename(trackId) },
        { label: 'Delete track', danger: true, onSelect: () => this.confirmDelete(trackId) },
      ])
    );

    return row;
  }

  // --- Renaming ---
  // Edited in place. `row.editing` keeps render() from typing over the field:
  // state arrives many times a second while a volume slider moves.

  beginRename(trackId) {
    const row = this.rows.get(trackId);
    if (!row || row.editing) return;

    row.editing = true;
    row.name.classList.add('editing');

    // Plain text where offered; the commit reads textContent either way.
    try {
      row.name.contentEditable = 'plaintext-only';
    } catch {
      row.name.contentEditable = 'true';
    }

    row.name.focus();

    // Select it all, so typing replaces rather than appends.
    const range = document.createRange();
    range.selectNodeContents(row.name);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  endRename(row, commit) {
    if (!row.editing) return;

    row.editing = false;
    row.name.contentEditable = 'false';
    row.name.classList.remove('editing');
    row.name.scrollLeft = 0; // a long name would otherwise stay scrolled off

    const track = this.trackFor(row.trackId);
    const name = row.name.textContent.replace(/\s+/g, ' ').trim();

    if (commit && name && name !== track?.name) {
      row.name.textContent = name; // shown now, confirmed when the state returns
      this.socket.emit('renameTrack', { trackId: row.trackId, name });
      return;
    }

    // Nothing worth sending, so restore whatever the track is actually called.
    if (track) row.name.textContent = track.name;
  }

  async confirmDelete(trackId) {
    const name = this.trackFor(trackId)?.name ?? trackId;
    const confirmed = await confirmDialog({
      title: `Delete "${name}"?`,
      body: 'The file is removed from the server. This cannot be undone.',
      confirm: 'Delete',
      danger: true,
    });
    if (confirmed) this.socket.emit('deleteTrack', { trackId });
  }

  /** The filled part of the slider, which CSS reads as a percentage. */
  paintSlider(row) {
    row.slider.style.setProperty('--fill', row.slider.value);
  }

  updateRow(row, track) {
    // Never type over a rename in progress.
    if (!row.editing) {
      row.name.textContent = track.name;
      row.name.title = track.name;
    }

    // Reparsing the icon on every state would churn the DOM 16 times a second.
    if (row.playing !== track.playing) {
      row.playing = track.playing;
      row.playButton.innerHTML = track.playing ? pause : play;
      row.playButton.title = track.playing ? 'Pause' : 'Play';
      row.item.classList.toggle('playing', track.playing);
    }

    // Never fight a slider that is currently being moved.
    if (!this.player.holding.has(track.trackId)) {
      row.slider.value = toSlider(track.volume);
      this.paintSlider(row);
    }
  }

  // --- Uploading ---

  /** Turn an element into a drop target, and a browse button, for audio files. */
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

    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'audio/*';
    picker.multiple = true;
    picker.hidden = true;
    picker.addEventListener('change', () => {
      this.uploadFiles(picker.files);
      picker.value = '';
    });

    // Outside the drop area: a picker inside its own trigger reopens forever.
    document.body.append(picker);
    element.addEventListener('click', () => picker.click());
  }

  async uploadFiles(files) {
    const audioFiles = [...files].filter((file) => file.type.startsWith('audio/'));
    if (audioFiles.length !== files.length) toast('Only audio files can be added as music.', 'error');

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
        toast(`Could not upload "${file.name}".`, 'error');
      }
    }
  }
}
