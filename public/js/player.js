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

// Get the audio element for music playback
const audioElement = document.getElementById('background-music');

// Keep track of whether audio has been enabled by the user
let audioEnabled = false;
let currentMusicData = null; // Keep track of the current music data

const enableAudioButton = document.getElementById('enable-audio-button');

// Handle music control events
socket.on('playMusic', (data) => {
  currentMusicData = data;

  if (audioEnabled) {
    if (audioElement.src !== data.musicUrl) {
      audioElement.src = data.musicUrl;
    }
    audioElement.currentTime = data.currentTime || 0;
    audioElement.play().catch((error) => {
      console.error('Error playing audio:', error);
    });
  } else {
    enableAudioButton.style.display = 'block';
  }
});

socket.on('pauseMusic', (data) => {
  currentMusicData = null; // No music is playing
  if (audioEnabled) {
    audioElement.pause();
    audioElement.currentTime = data.currentTime;
  }
});

socket.on('stopMusic', () => {
  currentMusicData = null; // No music is playing
  if (audioEnabled) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
});

// Handle volume change events from the server
socket.on('setVolume', (data) => {
  audioElement.volume = data.volume;
});

// Handle audio enable button
enableAudioButton.addEventListener('click', () => {
  audioEnabled = true;
  enableAudioButton.style.display = 'none';

  // Hide the audio overlay if applicable
  const audioOverlay = document.getElementById('audio-overlay');
  if (audioOverlay) {
    audioOverlay.style.display = 'none';
  }

  // Attempt to play music if music data is available
  if (currentMusicData) {
    // Only set src if it's different
    if (audioElement.src !== currentMusicData.musicUrl) {
      audioElement.src = currentMusicData.musicUrl;
    }
    audioElement.currentTime = currentMusicData.currentTime || 0;

    audioElement.play().catch((error) => {
      console.error('Error playing audio after enabling:', error);
    });
  }
});

// Ensure audio elements are not autoplaying without user interaction
document.addEventListener('DOMContentLoaded', () => {
  // Check if audio has already been enabled
  if (!audioEnabled) {
    enableAudioButton.style.display = 'block';
  }
});
