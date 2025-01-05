// public/js/dm.js

import { SceneManager } from './sceneManager.js';
import { MusicManager } from './musicManager.js';
import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const sceneContainer = document.getElementById('scene-container');
  const sceneRenderer = new SceneRenderer(sceneContainer);
  const panZoomHandler = new PanZoomHandler(sceneContainer, sceneRenderer);
  const tokenManager = new TokenManager(sceneRenderer, socket, true); // true indicates DM
  const sceneManager = new SceneManager(socket, sceneRenderer, tokenManager, sceneContainer);

  // Instantiate MusicManager
  const musicManager = new MusicManager(socket);

  // Handle scene creation
  document.getElementById('create-scene-button').addEventListener('click', () => {
    const sceneName = prompt('Enter a name for the new scene:');
    if (sceneName && sceneName.trim() !== '') {
      sceneManager.createScene(sceneName);
    }
  });

  // Music Upload Drop Area
  const musicDropArea = document.getElementById('music-drop-area');

  // Drag and Drop Event Listeners
  musicDropArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    musicDropArea.style.backgroundColor = '#f0f0f0'; // Optional: Visual feedback on drag enter
  });

  musicDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  musicDropArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    musicDropArea.style.backgroundColor = ''; // Optional: Reset visual feedback on drag leave
  });

  musicDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    musicDropArea.style.backgroundColor = ''; // Reset visual feedback on drop
    const files = e.dataTransfer.files;
    handleMusicFiles(files);
  });

  // Function to handle music files
  function handleMusicFiles(files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && file.type.startsWith('audio/')) {
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
              const displayName = data.displayName; // Optionally use a display name from the server
              // Add the music track to the MusicManager
              musicManager.addMusicTrack(musicUrl, filename, displayName);
            } else {
              alert('Music upload failed');
            }
          })
          .catch((error) => {
            console.error('Error uploading music:', error);
          });
      } else {
        alert('Please drop a valid audio file');
      }
    }
  }

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
          musicManager.addMusicTrack(track.url, track.filename, track.name);
        });
      } else {
        console.error('Error fetching music list:', data.message);
      }
    })
    .catch((error) => {
      console.error('Error fetching music list:', error);
    });


  
  // Volume Slider
  const volumeSlider = document.getElementById('volume-slider');

  // Add event listener for volume change
  volumeSlider.addEventListener('input', () => {
    const volume = volumeSlider.value / 100; // Normalize volume to 0.0 - 1.0
    musicManager.setVolume(volume);
  });
});
