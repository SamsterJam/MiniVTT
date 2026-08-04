// public/js/player.js

import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';
import { MusicPlayer } from './musicPlayer.js';
import { announce } from './announcements.js';

const socket = io();

const sceneContainer = document.getElementById('scene-container');
const sceneRenderer = new SceneRenderer(sceneContainer, false);
const tokenManager = new TokenManager(sceneRenderer, socket, false);

new PanZoomHandler(sceneContainer, sceneRenderer);

// === Scene ===
// The server pushes what to show; null means nothing. Hidden tokens never arrive.

socket.on('sceneData', (scene) => {
  if (!scene) return sceneRenderer.clear();

  sceneRenderer.renderScene(scene);
  scene.tokens.forEach((token) => tokenManager.setupTokenInteractions(token));
});

socket.on('sceneDeleted', ({ sceneId }) => {
  if (sceneRenderer.sceneId === sceneId) sceneRenderer.clear();
});

// === Tokens ===

socket.on('addToken', ({ sceneId, token }) => {
  if (sceneRenderer.sceneId !== sceneId) return;

  sceneRenderer.addToken(token);
  tokenManager.setupTokenInteractions(token);
});

socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
  if (sceneRenderer.sceneId !== sceneId) return;

  const token = sceneRenderer.tokenFor(tokenId);
  if (!token) return;

  Object.assign(token, properties);
  sceneRenderer.updateTokenElement(token, { glide: true });
  tokenManager.setupTokenInteractions(token);
});

socket.on('removeToken', ({ sceneId, tokenId }) => {
  if (sceneRenderer.sceneId === sceneId) sceneRenderer.removeToken(tokenId);
});

// === Music ===

const musicPlayer = new MusicPlayer();

socket.on('musicState', (tracks) => musicPlayer.sync(tracks));

// === Announcements ===
// Sent only when the DM has switched them on.

socket.on('announce', announce);

// Browsers block audio until the page has been interacted with.
document.getElementById('enable-audio-button').addEventListener('click', () => {
  document.getElementById('audio-overlay').remove();
  musicPlayer.enable();
});
