export class MusicManager {
  constructor(socket) {
    this.socket = socket;

    // Music management properties
    this.musicTracks = []; // List of uploaded music tracks
    this.currentMusicTrackIndex = null; // Index of the currently selected music track
    this.audioElement = new Audio(); // Audio element for music playback

    this.init();
  }

  init() {
    this.setupSocketListeners();
    // We will render the music list after tracks are added
  }

  // Method to add a music track
  addMusicTrack(musicUrl, name) {
    // Process name to remove leading numbers and hyphens/underscores
    const displayName = name.replace(/^\d+\s*[-_]?\s*/, '');

    const track = {
      url: musicUrl,
      name: displayName, // Use the processed display name
    };
    this.musicTracks.push(track);
    this.renderMusicList(); // Update the music list in the UI
  }

  // Method to render the music list in the UI
  renderMusicList() {
    const musicListElement = document.getElementById('music-list');
    musicListElement.innerHTML = ''; // Clear existing list

    this.musicTracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.textContent = track.name;
      li.dataset.index = index;

      // Event listener for selecting a music track
      li.addEventListener('click', () => this.onMusicTrackClick(index));

      // Highlight the selected track
      if (this.currentMusicTrackIndex === index) {
        li.classList.add('selected');
      }

      musicListElement.appendChild(li);
    });
  }

  // Method to handle music track selection
  onMusicTrackClick(index) {
    this.currentMusicTrackIndex = index;
    this.renderMusicList(); // Update UI

    const track = this.musicTracks[index];

    // Load the selected track into the audio element but do not play yet
    this.audioElement.src = track.url;
    this.audioElement.currentTime = 0;
  }

  // Method to play music
  playMusic() {
    if (this.currentMusicTrackIndex != null) {
      this.audioElement.play();

      // Notify players to play the music
      this.socket.emit('playMusic', {
        musicUrl: this.audioElement.src,
        currentTime: this.audioElement.currentTime,
      });
    } else {
      alert('Please select a music track to play');
    }
  }

  // Method to pause music
  pauseMusic() {
    if (this.audioElement.src) {
      this.audioElement.pause();

      // Notify players to pause the music
      this.socket.emit('pauseMusic', {
        currentTime: this.audioElement.currentTime,
      });
    }
  }

  // Method to stop music
  stopMusic() {
    if (this.audioElement.src) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;

      // Notify players to stop the music
      this.socket.emit('stopMusic');
    }
  }

  // Socket event listeners
  setupSocketListeners() {
    // Music control events from the server
    this.socket.on('playMusic', (data) => {
      this.onPlayMusic(data.musicUrl, data.currentTime);
    });

    this.socket.on('pauseMusic', (data) => {
      this.onPauseMusic(data.currentTime);
    });

    this.socket.on('stopMusic', () => {
      this.onStopMusic();
    });
  }

  // Client-side handlers for music events (optional for DM)
  onPlayMusic(musicUrl, currentTime) {
    // If the DM didn't initiate the play, sync the audio element
    if (this.audioElement.src !== musicUrl) {
      this.audioElement.src = musicUrl;
    }
    if (this.audioElement.currentTime !== currentTime) {
      this.audioElement.currentTime = currentTime;
    }
    if (this.audioElement.paused) {
      this.audioElement.play();
    }
  }

  onPauseMusic(currentTime) {
    this.audioElement.currentTime = currentTime;
    if (!this.audioElement.paused) {
      this.audioElement.pause();
    }
  }

  onStopMusic() {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }
}