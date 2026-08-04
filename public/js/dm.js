// public/js/dm.js
import { SceneManager } from './sceneManager.js';
import { MusicManager } from './musicManager.js';
import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // Ask for the DM role; the server grants it only to a session that logged in
  // at /dm-login. The player page never asks, so it stays a player view even in
  // the DM's own browser.
  const socket = io({ query: { role: 'dm' } });
  const sceneContainer = document.getElementById('scene-container');

  const sceneRenderer = new SceneRenderer(sceneContainer, true);
  const tokenManager = new TokenManager(sceneRenderer, socket, true);

  new PanZoomHandler(sceneContainer, sceneRenderer);
  const sceneManager = new SceneManager(socket, sceneRenderer, tokenManager, sceneContainer);

  const musicManager = new MusicManager(socket);
  musicManager.attachDropTarget(document.getElementById('music-drop-area'));
  musicManager.loadTracks();

  document.getElementById('create-scene-button').addEventListener('click', () => {
    const sceneName = prompt('Enter a name for the new scene:');
    if (sceneName?.trim()) sceneManager.createScene(sceneName.trim());
  });
});
