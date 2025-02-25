// public/js/dm.js

import { SceneManager } from './sceneManager.js';
import { MusicManager } from './musicManager.js';
import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const socket = io({ query: { role: 'dm' } });
  const sceneContainer = document.getElementById('scene-container');
  const sceneRenderer = new SceneRenderer(sceneContainer, true);
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
    musicDropArea.style.backgroundColor = '#f0f0f0';
  });

  musicDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  musicDropArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    musicDropArea.style.backgroundColor = '';
  });

  musicDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    musicDropArea.style.backgroundColor = '';
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
              const displayName = data.displayName;
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

  // Fetch the list of uploaded music tracks when the page loads
  fetch('/musicList')
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Add each track to the MusicManager
        data.musicTracks.forEach((track) => {
          musicManager.addMusicTrack(track.url, track.filename, track.name, track.trackId);
        });
      } else {
        console.error('Error fetching music list:', data.message);
      }
    })
    .catch((error) => {
      console.error('Error fetching music list:', error);
    });
});