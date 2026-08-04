// public/js/dm.js
import { SceneManager } from './sceneManager.js';
import { MusicManager } from './musicManager.js';
import { SettingsManager } from './settingsManager.js';
import { SceneRenderer } from './sceneRenderer.js';
import { PanZoomHandler } from './panZoomHandler.js';
import { TokenManager } from './tokenManager.js';
import { COMMANDS, keyLabel } from './commands.js';
import { dismissOnBackdrop } from './ui.js';
import { plus, music, settings, help, close } from './icons.js';

/** Draw the shortcut overlay from the command table, grouped as declared. */
function buildShortcutList(container) {
  const groups = new Map();
  for (const command of COMMANDS) {
    if (!groups.has(command.group)) groups.set(command.group, []);
    groups.get(command.group).push(command);
  }

  container.replaceChildren(
    ...[...groups].map(([name, commands]) => {
      const group = document.createElement('div');
      group.className = 'shortcut-group';

      const heading = document.createElement('h3');
      heading.textContent = name;
      group.append(heading);

      for (const command of commands) {
        const row = document.createElement('div');
        row.className = 'shortcut';

        const label = document.createElement('span');
        label.textContent = command.label;

        const key = document.createElement('kbd');
        key.textContent = keyLabel(command.key);

        row.append(label, key);
        group.append(row);
      }
      return group;
    })
  );
}

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

  new SettingsManager(socket);

  // --- Chrome ---

  const createButton = document.getElementById('create-scene-button');
  const musicButton = document.getElementById('music-toggle');
  const settingsButton = document.getElementById('settings-toggle');
  const helpButton = document.getElementById('help-toggle');
  const musicClose = document.getElementById('music-close');

  createButton.innerHTML = plus;
  musicButton.innerHTML = music;
  settingsButton.innerHTML = settings;
  helpButton.innerHTML = help;
  musicClose.innerHTML = close;

  createButton.addEventListener('click', () => sceneManager.promptNewScene());
  settingsButton.addEventListener('click', () => sceneManager.toggleSettings());
  helpButton.addEventListener('click', () => sceneManager.toggleHelp());
  musicButton.addEventListener('click', () => sceneManager.toggleMusic());
  musicClose.addEventListener('click', () => sceneManager.toggleMusic());

  buildShortcutList(document.querySelector('#help-dialog .shortcut-groups'));

  // The cards ui.js builds wire themselves; these two are in the markup.
  for (const dialog of document.querySelectorAll('dialog')) dismissOnBackdrop(dialog);

  // A dot for when the panel is closed over a playing track. CSS hides it
  // again once the panel is open to speak for itself.
  socket.on('musicState', (tracks) => {
    musicButton.classList.toggle('is-playing', tracks.some((track) => track.playing));
  });
});
