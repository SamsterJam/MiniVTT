// public/js/player.js

import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';
import { MusicPlayer } from './musicPlayer.js';

const socket = io();

let currentScene = null;

const sceneContainer = document.getElementById('scene-container');
const sceneRenderer = new SceneRenderer(sceneContainer, false);
const panZoomHandler = new PanZoomHandler(sceneContainer, sceneRenderer);
const tokenManager = new TokenManager(sceneRenderer, socket, false);

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

// The server never sends hidden tokens to a player.
function renderScene(scene) {
  sceneRenderer.renderScene(scene);
  scene.tokens.forEach((token) => tokenManager.setupTokenInteractions(token));
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

  sceneRenderer.removeTokenElement(tokenId);
});

// === Music ===

const musicPlayer = new MusicPlayer();

socket.on('musicState', (tracks) => musicPlayer.sync(tracks));

// Browsers block audio until the page has been interacted with.
document.getElementById('enable-audio-button').addEventListener('click', () => {
  document.getElementById('audio-overlay').remove();
  musicPlayer.enable();
});
