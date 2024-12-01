import { SceneManager } from './sceneManager.js';
import { MusicManager } from './musicManager.js'; // Import MusicManager

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const sceneContainer = document.getElementById('scene-container');
  const sceneManager = new SceneManager(socket, sceneContainer);

  // Instantiate MusicManager
  const musicManager = new MusicManager(socket);

  // Handle scene creation
  document.getElementById('create-scene-button').addEventListener('click', () => {
    const sceneName = prompt('Enter a name for the new scene:');
    if (sceneName && sceneName.trim() !== '') {
      sceneManager.createScene(sceneName);
    }
  });

  // Music Upload Elements
  const musicUploadInput = document.getElementById('music-upload-input');
  const uploadMusicButton = document.getElementById('upload-music-button');

  // Upload Music Event Listener
  uploadMusicButton.addEventListener('click', () => {
    const file = musicUploadInput.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('music', file);

      fetch('/uploadMusic', {
        method: 'POST',
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            const musicUrl = data.musicUrl;
            const filename = data.filename;
            // Add the music track to the MusicManager
            musicManager.addMusicTrack(musicUrl, filename);
          } else {
            alert('Music upload failed');
          }
        })
        .catch((error) => {
          console.error('Error uploading music:', error);
        });
    } else {
      alert('Please select a music file to upload');
    }
  });

  // Music Control Buttons
  const playMusicButton = document.getElementById('play-music-button');
  const pauseMusicButton = document.getElementById('pause-music-button');
  const stopMusicButton = document.getElementById('stop-music-button');

  // Music Control Event Listeners
  playMusicButton.addEventListener('click', () => {
    musicManager.playMusic();
  });

  pauseMusicButton.addEventListener('click', () => {
    musicManager.pauseMusic();
  });

  stopMusicButton.addEventListener('click', () => {
    musicManager.stopMusic();
  });

  // Fetch the list of uploaded music tracks when the page loads
  fetch('/musicList')
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Add each track to the MusicManager
        data.musicTracks.forEach((track) => {
          musicManager.addMusicTrack(track.url, track.name);
        });
      } else {
        console.error('Error fetching music list:', data.message);
      }
    })
    .catch((error) => {
      console.error('Error fetching music list:', error);
    });
});
