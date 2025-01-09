// public/js/player.js

import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';

const socket = io();

let currentScene = null;

const sceneContainer = document.getElementById('scene-container');
const sceneRenderer = new SceneRenderer(sceneContainer);
const panZoomHandler = new PanZoomHandler(sceneContainer, sceneRenderer);
const tokenManager = new TokenManager(sceneRenderer, socket, false); // false indicates player

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
  sceneRenderer.renderScene(scene);

  // After rendering tokens, setup interactions
  scene.tokens.forEach((token) => {
    tokenManager.setupTokenInteractions(token);
  });
}

// Handle token updates from the server
socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
  if (!currentScene || currentScene.sceneId !== sceneId) return;

  const token = currentScene.tokens.find((t) => t.tokenId === tokenId);
  if (token) {
    // Update token properties
    Object.assign(token, properties);

    // Update the DOM element
    sceneRenderer.updateTokenElement(token);

    // Always setup interactions to reflect any changes
    tokenManager.setupTokenInteractions(token);
  }
});

// Handle addition of new tokens
socket.on('addToken', ({ sceneId, token }) => {
  if (!currentScene || currentScene.sceneId !== sceneId) return;

  // Add the new token to the scene's token list
  currentScene.tokens.push(token);

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

  const tokenIndex = currentScene.tokens.findIndex((t) => t.tokenId === tokenId);
  if (tokenIndex !== -1) {
    // Remove from currentScene.tokens
    currentScene.tokens.splice(tokenIndex, 1);
    // Remove from DOM
    const element = document.getElementById(`token-${tokenId}`);
    if (element && element.parentNode === sceneContainer) {
      sceneContainer.removeChild(element);
    }
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
  audioElement.loop = true; // Set looping if desired
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
  const { trackId, musicUrl, currentTime } = data;
  let track = musicTracks[trackId];

  if (!track) {
    // If the track doesn't exist, create it
    const audioElement = new Audio(musicUrl);
    audioElement.loop = true;
    audioElement.volume = 1.0;

    track = {
      trackId: trackId,
      audioElement: audioElement,
      isPlaying: false,
      volume: 1.0,
    };

    musicTracks[trackId] = track;
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