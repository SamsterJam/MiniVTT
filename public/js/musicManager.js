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

    // Music control buttons
    this.playMusicButton = document.getElementById('play-music-button');
    this.pauseMusicButton = document.getElementById('pause-music-button');
    this.stopMusicButton = document.getElementById('stop-music-button');
    this.deleteMusicButton = document.getElementById('delete-music-button');

    // Event listeners
    this.playMusicButton.addEventListener('click', () => this.playMusic());
    this.pauseMusicButton.addEventListener('click', () => this.pauseMusic());
    this.stopMusicButton.addEventListener('click', () => this.stopMusic());
    this.deleteMusicButton.addEventListener('click', () => this.deleteSelectedMusicTrack());

    // We will render the music list after tracks are added
  }

  // Method to add a music track
  addMusicTrack(musicUrl, filename, displayName) {
    // Process name to remove leading numbers and hyphens/underscores
    const displayNameProcessed = displayName || filename.replace(/^\d+\s*[-_]?\s*/, '');

    const track = {
      url: musicUrl,
      filename: filename, // Store the filename for deletion
      name: displayNameProcessed, // Use the processed display name
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

      const trackNameSpan = document.createElement('span');
      trackNameSpan.textContent = track.name;
      trackNameSpan.style.cursor = 'pointer';

      // Event listener for selecting a music track
      trackNameSpan.addEventListener('click', () => this.onMusicTrackClick(index));

      // Highlight the selected track
      if (this.currentMusicTrackIndex === index) {
        li.classList.add('selected-track');
      }

      li.appendChild(trackNameSpan);
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

  // Method to delete the selected music track
  deleteSelectedMusicTrack() {
    if (this.currentMusicTrackIndex != null) {
      this.deleteMusicTrack(this.currentMusicTrackIndex);
    } else {
      alert('Please select a music track to delete');
    }
  }

  // Method to delete a music track
  deleteMusicTrack(index) {
    const track = this.musicTracks[index];

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${track.name}"?`)) {
      return;
    }

    fetch('/deleteMusic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename: track.filename }) // Send the filename to the server
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Remove the track from the array
          this.musicTracks.splice(index, 1);

          // If the deleted track was currently selected, reset currentMusicTrackIndex
          if (this.currentMusicTrackIndex === index) {
            this.currentMusicTrackIndex = null;
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.audioElement.src = '';
          }

          this.renderMusicList(); // Update the music list
        } else {
          alert('Failed to delete music track.');
        }
      })
      .catch(err => {
        console.error('Error deleting music track:', err);
      });
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