// public/js/player.js

import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';

const socket = io({ query: { role: 'player' } });

let currentScene = null;

const sceneContainer = document.getElementById('scene-container');
const sceneRenderer = new SceneRenderer(sceneContainer, false);
const panZoomHandler = new PanZoomHandler(sceneContainer, sceneRenderer);
const tokenManager = new TokenManager(sceneRenderer, socket, false);

// Music management properties
const musicTracks = {}; // Object to store tracks by trackId

// Receive active scene ID from server
socket.on('activeSceneId', (sceneId) => {
  if (sceneId) {
    loadScene(sceneId);
  }
});

// Function to load a scene
function loadScene(sceneId) {
  socket.emit('loadScene', { sceneId: sceneId });
}

// Handle receiving scene data
socket.on('sceneData', (scene) => {
  currentScene = scene;
  renderScene(scene);
});

// Function to render a scene
function renderScene(scene) {
  const visibleTokens = scene.tokens.filter(token => !token.hidden);
  const sceneCopy = Object.assign({}, scene, { tokens: visibleTokens });
  sceneRenderer.renderScene(sceneCopy);

  visibleTokens.forEach((token) => {
    tokenManager.setupTokenInteractions(token);
  });
}

// Handle token updates from the server
socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
  if (!currentScene || currentScene.sceneId !== sceneId) return;

  // Find the token in currentScene.tokens
  let token = currentScene.tokens.find(t => t.tokenId === tokenId);

  if (token) {
    // Token exists, update its properties
    Object.assign(token, properties);

    // Update the DOM element
    sceneRenderer.updateTokenElement(token);

    // Update interactions
    tokenManager.setupTokenInteractions(token);
  } else {
    // Token might have been unhidden
    if (!properties.hidden) {
      // Add the token to the scene
      token = { tokenId, sceneId, ...properties };
      currentScene.tokens.push(token);

      // Render the token
      sceneRenderer.renderToken(token);

      // Setup interactions
      tokenManager.setupTokenInteractions(token);
    }
  }
});

// Handle addition of new tokens
socket.on('addToken', ({ sceneId, token }) => {
  if (!currentScene || currentScene.sceneId !== sceneId) return;

  // Add the new token to the scene's token list
  currentScene.tokens.push(token);

  // Add the new token to the sceneRenderer's tokens array
  sceneRenderer.tokens.push(token);

  // Render the new token
  sceneRenderer.renderToken(token);

  // Setup interactions
  if (token.movableByPlayers) {
    tokenManager.setupTokenInteractions(token);
  } else {
    tokenManager.toggleHoverShadow(token, false);
  }
});

// Handle removal of tokens
socket.on('removeToken', ({ sceneId, tokenId }) => {
  if (!currentScene || currentScene.sceneId !== sceneId) return;

  // Remove from currentScene.tokens
  currentScene.tokens = currentScene.tokens.filter(t => t.tokenId !== tokenId);
  // Remove from sceneRenderer.tokens
  sceneRenderer.tokens = sceneRenderer.tokens.filter(t => t.tokenId !== tokenId);

  // Remove from DOM
  const element = document.getElementById(`token-${tokenId}`);
  if (element && element.parentNode === sceneContainer) {
    sceneContainer.removeChild(element);
  }
});

// === Music Handling Code ===

// Keep track of whether audio has been enabled by the user
let audioEnabled = false;

// Handle audio enable button
const enableAudioButton = document.getElementById('enable-audio-button');
enableAudioButton.addEventListener('click', () => {
  audioEnabled = true;
  enableAudioButton.style.display = 'none';

  // Hide the audio overlay if applicable
  const audioOverlay = document.getElementById('audio-overlay');
  if (audioOverlay) {
    audioOverlay.style.display = 'none';
  }

  // Play any tracks that are currently playing
  for (const trackId in musicTracks) {
    const track = musicTracks[trackId];
    if (track.isPlaying) {
      track.audioElement.play().catch((error) => {
        console.error('Error playing audio:', error);
      });
    }
  }
});

// Handle new track addition
socket.on('addTrack', (data) => {
  const { trackId, musicUrl, name } = data;

  // Avoid adding the same track multiple times
  if (musicTracks[trackId]) return;

  const audioElement = new Audio(musicUrl);
  audioElement.loop = true;
  audioElement.volume = 1.0;

  const track = {
    trackId: trackId,
    name: name,
    audioElement: audioElement,
    isPlaying: false,
    volume: 1.0,
  };

  musicTracks[trackId] = track;

  // If audio is enabled and the track is supposed to be playing, start playing
});

// Handle track deletion
socket.on('deleteTrack', (data) => {
  const { trackId } = data;
  const track = musicTracks[trackId];
  if (track) {
    track.audioElement.pause();
    track.audioElement.src = '';
    delete musicTracks[trackId];
  }
});

// Handle play track
socket.on('playTrack', (data) => {
  const { trackId, musicUrl, currentTime, volume } = data;
  let track = musicTracks[trackId];

  if (!track) {
    // If the track doesn't exist, create it
    const audioElement = new Audio(musicUrl);
    audioElement.loop = true;
    audioElement.volume = volume !== undefined ? volume : 0.5; // Set volume from DM or default

    track = {
      trackId: trackId,
      audioElement: audioElement,
      isPlaying: false,
      volume: audioElement.volume,
    };

    musicTracks[trackId] = track;
  } else {
    // If the track already exists, update the volume if provided
    if (volume !== undefined) {
      track.audioElement.volume = volume;
      track.volume = volume;
    }
  }

  track.audioElement.currentTime = currentTime || 0;
  track.isPlaying = true;

  if (audioEnabled) {
    track.audioElement.play().catch((error) => {
      console.error('Error playing audio:', error);
    });
  }
});

// Handle pause track
socket.on('pauseTrack', (data) => {
  const { trackId, currentTime } = data;
  const track = musicTracks[trackId];
  if (track) {
    track.audioElement.pause();
    track.audioElement.currentTime = currentTime || 0;
    track.isPlaying = false;
  }
});

// Handle set track volume
socket.on('setTrackVolume', (data) => {
  const { trackId, volume } = data;
  const track = musicTracks[trackId];
  if (track) {
    track.audioElement.volume = volume;
    track.volume = volume;
  }
});

// Ensure audio elements are not autoplaying without user interaction
document.addEventListener('DOMContentLoaded', () => {
  // Check if audio has already been enabled
  if (!audioEnabled) {
    enableAudioButton.style.display = 'block';
  }
});