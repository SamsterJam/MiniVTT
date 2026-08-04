// public/js/sceneManager.js
import { confirmDialog, promptDialog, toast, contextMenu } from './ui.js';
import { COMMANDS, BAR_COMMANDS, comboFor, keyLabel } from './commands.js';

const MAX_TOKEN_DIMENSION = 200;

// A duplicate is offset so it does not hide under the original.
const DUPLICATE_OFFSET = 20;

const NUDGE = 1;
const NUDGE_BOOST = 10;

// Slack before a press on the canvas becomes a marquee rather than a click.
const MARQUEE_SLOP = 4;

// Assumed line height, for wheels that report scrolling in lines.
const WHEEL_LINE = 16;

// Share of the remaining distance the tab strip covers each frame.
const WHEEL_EASE = 0.22;

const newTokenId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/** Scale natural media dimensions down to fit MAX_TOKEN_DIMENSION. */
function fit(width, height) {
  const scale = Math.min(1, MAX_TOKEN_DIMENSION / Math.max(width, height));
  return { width: width * scale, height: height * scale };
}

/** The size a dropped file should become, once the browser has read it. */
function mediaSize(url, mediaType) {
  return new Promise((resolve, reject) => {
    const failed = () => reject(new Error(`Could not read ${url}`));

    if (mediaType === 'video') {
      const video = document.createElement('video');
      video.addEventListener('loadedmetadata', () =>
        resolve(fit(video.videoWidth, video.videoHeight))
      );
      video.addEventListener('error', failed);
      video.src = url;
    } else {
      const image = new Image();
      image.onload = () => resolve(fit(image.naturalWidth, image.naturalHeight));
      image.onerror = failed;
      image.src = url;
    }
  });
}

export class SceneManager {
  constructor(socket, sceneRenderer, tokenManager, sceneContainer) {
    this.socket = socket;
    this.sceneRenderer = sceneRenderer;
    this.tokenManager = tokenManager;
    this.sceneContainer = sceneContainer;

    this.scenes = [];
    this.selection = new Set(); // tokenIds

    this.tabsContainer = document.getElementById('scene-tabs');
    this.actionBar = document.getElementById('token-actions');
    this.marquee = document.getElementById('marquee');

    // Dragging any member of the selection carries the whole group with it.
    tokenManager.selectionFor = (token) =>
      this.selection.has(token.tokenId) ? this.selectedTokens() : [token];

    this.buildActionBar();
    this.listenToServer();
    this.listenToInput();
  }

  // --- Server ---
  // The scene list and the scene itself are both pushed; nothing is requested.

  listenToServer() {
    this.socket.on('sceneList', (scenes) => {
      this.scenes = scenes;
      this.renderSceneTabs();
    });

    this.socket.on('sceneData', (scene) => this.onSceneData(scene));

    this.socket.on('sceneDeleted', ({ sceneId }) => {
      if (this.sceneRenderer.sceneId === sceneId) this.onSceneData(null);
    });

    this.socket.on('addToken', ({ sceneId, token }) => {
      if (this.sceneRenderer.sceneId !== sceneId) return;
      this.sceneRenderer.addToken(token);
      this.tokenManager.setupTokenInteractions(token);
    });

    this.socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
      if (this.sceneRenderer.sceneId !== sceneId) return;

      const token = this.sceneRenderer.tokenFor(tokenId);
      if (!token) return;

      Object.assign(token, properties);
      this.sceneRenderer.updateTokenElement(token);
      this.tokenManager.setupTokenInteractions(token);
      this.renderSelection();
    });

    this.socket.on('removeToken', ({ sceneId, tokenId }) => {
      if (this.sceneRenderer.sceneId !== sceneId) return;
      this.sceneRenderer.removeToken(tokenId);
      if (this.selection.delete(tokenId)) this.renderSelection();
    });
  }

  listenToInput() {
    this.sceneContainer.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    this.sceneContainer.addEventListener('drop', (event) => this.onDrop(event));

    this.sceneContainer.addEventListener('mousedown', (event) => this.onMouseDown(event));
    this.listenToTabScroll();

    // Delegated: a per-token listener was re-added on every server update.
    this.sceneContainer.addEventListener('click', (event) => this.onClick(event));

    document.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  /** Vertical wheel scrolls the tab strip sideways, eased over frames. */
  listenToTabScroll() {
    const tabs = this.tabsContainer;
    let target = null; // where the strip is heading, or null while it rests

    const glide = () => {
      // Re-measured: a scene added mid-glide moves the end of the strip.
      const limit = Math.max(tabs.scrollWidth - tabs.clientWidth, 0);
      target = Math.min(target, limit);

      const distance = target - tabs.scrollLeft;
      if (Math.abs(distance) < 0.5) {
        tabs.scrollLeft = target;
        target = null;
        return;
      }

      tabs.scrollLeft += distance * WHEEL_EASE;
      requestAnimationFrame(glide);
    };

    tabs.addEventListener(
      'wheel',
      (event) => {
        const limit = tabs.scrollWidth - tabs.clientWidth;
        if (limit <= 0) return; // nothing to scroll; leave the event alone

        event.preventDefault();

        // Aim from the current target, so spinning the wheel builds distance.
        const step = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE : 1;
        const from = target ?? tabs.scrollLeft;
        const resting = target === null;

        target = Math.min(Math.max(from + (event.deltaY + event.deltaX) * step, 0), limit);
        if (resting) requestAnimationFrame(glide);
      },
      { passive: false }
    );
  }

  // --- Scenes ---

  currentScene() {
    return this.scenes.find((scene) => scene.sceneId === this.sceneRenderer.sceneId) ?? null;
  }

  renderSceneTabs() {
    this.tabsContainer.replaceChildren(
      ...this.scenes.map((scene) => {
        const button = document.createElement('button');
        button.className = 'btn scene-tab';
        button.textContent = scene.sceneName;
        button.title = scene.sceneName;
        button.dataset.sceneId = scene.sceneId;
        button.classList.toggle('active', scene.sceneId === this.sceneRenderer.sceneId);

        button.addEventListener('click', () =>
          this.socket.emit('changeScene', { sceneId: scene.sceneId })
        );
        button.addEventListener('dblclick', () => this.promptRenameScene(scene));
        button.addEventListener('contextmenu', (event) =>
          contextMenu(event, [
            { label: 'Rename', onSelect: () => this.promptRenameScene(scene) },
            {
              label: 'Duplicate',
              onSelect: () => this.socket.emit('duplicateScene', { sceneId: scene.sceneId }),
            },
            { label: 'Delete', danger: true, onSelect: () => this.confirmDeleteScene(scene) },
          ])
        );
        return button;
      })
    );

    this.sortable ??= new Sortable(this.tabsContainer, {
      animation: 150,
      onEnd: () => {
        const tabs = this.tabsContainer.querySelectorAll('.scene-tab');
        const sceneOrder = [...tabs].map((tab) => tab.dataset.sceneId);
        this.socket.emit('reorderScenes', { sceneOrder });
      },
    });
  }

  onSceneData(scene) {
    this.selection.clear();

    if (!scene) this.sceneRenderer.clear();
    else {
      this.sceneRenderer.renderScene(scene);
      scene.tokens.forEach((token) => this.tokenManager.setupTokenInteractions(token));
    }

    this.renderSelection();

    for (const tab of this.tabsContainer.querySelectorAll('.scene-tab')) {
      tab.classList.toggle('active', tab.dataset.sceneId === this.sceneRenderer.sceneId);
    }
  }

  async promptNewScene() {
    const sceneName = await promptDialog({
      title: 'New scene',
      placeholder: 'Scene name',
      confirm: 'Create',
    });
    if (sceneName) this.socket.emit('createScene', { sceneName });
  }

  async promptRenameScene(scene = this.currentScene()) {
    if (!scene) return toast('No scene is loaded.', 'error');

    const sceneName = await promptDialog({
      title: 'Rename scene',
      value: scene.sceneName,
      confirm: 'Rename',
    });
    if (sceneName) this.socket.emit('renameScene', { sceneId: scene.sceneId, sceneName });
  }

  async confirmDeleteScene(scene = this.currentScene()) {
    if (!scene) return toast('No scene is loaded.', 'error');

    const confirmed = await confirmDialog({
      title: `Delete "${scene.sceneName}"?`,
      body: 'The scene goes, along with any media no other scene is using. This cannot be undone.',
      confirm: 'Delete scene',
      danger: true,
    });
    if (confirmed) this.socket.emit('deleteScene', { sceneId: scene.sceneId });
  }

  // --- Selection ---

  selectedTokens() {
    return [...this.selection]
      .map((tokenId) => this.sceneRenderer.tokenFor(tokenId))
      .filter(Boolean);
  }

  setSelection(tokenIds) {
    this.selection = new Set(tokenIds);
    this.renderSelection();
  }

  toggleSelected(tokenId) {
    if (!this.selection.delete(tokenId)) this.selection.add(tokenId);
    this.renderSelection();
  }

  selectAll() {
    this.setSelection(this.sceneRenderer.tokens.map((token) => token.tokenId));
  }

  renderSelection() {
    for (const token of this.sceneRenderer.tokens) {
      this.sceneRenderer
        .elementFor(token.tokenId)
        ?.classList.toggle('is-selected', this.selection.has(token.tokenId));
    }
    this.renderActionBar();
  }

  onClick(event) {
    const element = event.target.closest('.token');

    // Canvas clicks belong to the marquee; the tail of a drag arrives as a click.
    if (!element || !this.tokenManager.wasClick()) return;

    const { tokenId } = element.dataset;
    if (event.shiftKey || event.ctrlKey) this.toggleSelected(tokenId);
    else this.setSelection([tokenId]);
  }

  /** Press on a token may become a drag; on empty canvas, a marquee. */
  onMouseDown(event) {
    if (event.button !== 0) return;

    const element = event.target.closest('.token');
    if (element) {
      const { tokenId } = element.dataset;

      // Selected tokens drag as a group; modified presses belong to onClick.
      if (event.shiftKey || event.ctrlKey || this.selection.has(tokenId)) return;

      this.dropSelectionOnDrag(event);
      return;
    }

    const start = { x: event.clientX, y: event.clientY };
    const base = event.shiftKey || event.ctrlKey ? [...this.selection] : [];
    let dragging = false;

    const onMove = (move) => {
      dragging ||= Math.hypot(move.clientX - start.x, move.clientY - start.y) > MARQUEE_SLOP;
      if (!dragging) return;

      this.drawMarquee(start, move);
      this.setSelection([...base, ...this.tokenIdsWithin(start, move)]);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      this.marquee.classList.remove('active');
      if (!dragging) this.setSelection(base);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  }

  /**
   * Dragging an unselected token moves it without selecting it, but must not
   * leave the old selection lit either. Deferred past the travel threshold, so
   * a slow click does not blink the outline off and back on.
   */
  dropSelectionOnDrag(event) {
    if (this.selection.size === 0) return;

    const start = { x: event.clientX, y: event.clientY };

    const onMove = (move) => {
      if (Math.hypot(move.clientX - start.x, move.clientY - start.y) <= MARQUEE_SLOP) return;
      stop();
      this.setSelection([]);
    };

    const stop = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', stop);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', stop);
  }

  drawMarquee(start, current) {
    const rect = this.sceneContainer.getBoundingClientRect();

    this.marquee.style.left = `${Math.min(start.x, current.x) - rect.left}px`;
    this.marquee.style.top = `${Math.min(start.y, current.y) - rect.top}px`;
    this.marquee.style.width = `${Math.abs(current.x - start.x)}px`;
    this.marquee.style.height = `${Math.abs(current.y - start.y)}px`;
    this.marquee.classList.add('active');
  }

  /** Tokens the marquee overlaps, compared in world units so zoom is irrelevant. */
  tokenIdsWithin(start, current) {
    const a = this.sceneRenderer.screenToWorld(
      Math.min(start.x, current.x),
      Math.min(start.y, current.y)
    );
    const b = this.sceneRenderer.screenToWorld(
      Math.max(start.x, current.x),
      Math.max(start.y, current.y)
    );

    return this.sceneRenderer.tokens
      .filter(
        (token) =>
          token.x < b.x &&
          token.x + token.width > a.x &&
          token.y < b.y &&
          token.y + token.height > a.y
      )
      .map((token) => token.tokenId);
  }

  // --- Selection bar ---
  // Built from the same table the keyboard reads, so the two cannot disagree.

  buildActionBar() {
    this.countLabel = document.createElement('span');
    this.countLabel.className = 'selection-count';

    this.actionButtons = BAR_COMMANDS.map((command) => {
      const button = document.createElement('button');
      button.className = `btn icon${command.danger ? ' danger' : ''}`;
      button.innerHTML = command.icon;
      button.title = `${command.label}  (${keyLabel(command.key)})`;
      button.addEventListener('click', () => command.run(this));
      return { command, button };
    });

    this.actionBar.replaceChildren(
      this.countLabel,
      ...this.actionButtons.map(({ button }) => button)
    );
  }

  renderActionBar() {
    const tokens = this.selectedTokens();
    this.actionBar.classList.toggle('visible', tokens.length > 0);
    if (tokens.length === 0) return;

    this.countLabel.textContent = tokens.length === 1 ? '1 token' : `${tokens.length} tokens`;

    for (const { command, button } of this.actionButtons) {
      button.classList.toggle('is-on', Boolean(command.active?.(tokens)));
    }
  }

  // --- Tokens ---

  /** Change a token here and tell the server; everyone else hears it from there. */
  updateToken(token, properties) {
    Object.assign(token, properties);
    this.sceneRenderer.updateTokenElement(token);
    this.socket.emit('updateToken', {
      sceneId: this.sceneRenderer.sceneId,
      tokenId: token.tokenId,
      properties,
    });
  }

  addToken(token) {
    this.sceneRenderer.addToken(token);
    this.tokenManager.setupTokenInteractions(token);
    this.socket.emit('addToken', { sceneId: this.sceneRenderer.sceneId, token });
  }

  /** Flip a boolean across the selection, settling every token on one state. */
  toggleTokenFlag(field) {
    const tokens = this.selectedTokens();
    if (tokens.length === 0) return;

    // Mixed selections turn on, so one press always leads somewhere definite.
    const value = !tokens.every((token) => token[field]);

    for (const token of tokens) {
      if (token[field] === value) continue;
      this.updateToken(token, { [field]: value });
      this.tokenManager.setupTokenInteractions(token);
    }
    this.renderSelection();
  }

  nudgeSelection(dx, dy) {
    for (const token of this.selectedTokens()) {
      this.updateToken(token, { x: token.x + dx, y: token.y + dy });
    }
  }

  /** Swap each selected token past its nearest unselected neighbour. */
  moveLayer(direction) {
    const stack = [...this.sceneRenderer.tokens].sort((a, b) => a.zIndex - b.zIndex);

    // Walk from the leading end, so a block keeps its internal order.
    const order = direction > 0 ? [...stack].reverse() : stack;

    for (const token of order) {
      if (!this.selection.has(token.tokenId)) continue;

      const index = stack.indexOf(token);
      const neighbour = stack[index + direction];

      // Swapping with another selected token would move the pair nowhere.
      if (!neighbour || this.selection.has(neighbour.tokenId)) continue;

      const zIndex = token.zIndex;
      this.updateToken(token, { zIndex: neighbour.zIndex });
      this.updateToken(neighbour, { zIndex });

      stack[index] = neighbour;
      stack[index + direction] = token;
    }
  }

  duplicateSelection() {
    const copies = this.selectedTokens().map((token) => {
      const copy = {
        ...token,
        tokenId: newTokenId(),
        x: token.x + DUPLICATE_OFFSET,
        y: token.y + DUPLICATE_OFFSET,
        zIndex: token.zIndex + 1,
      };
      this.addToken(copy);
      return copy.tokenId;
    });

    // The copies become the selection, so a duplicate can be dragged straight off.
    if (copies.length > 0) this.setSelection(copies);
  }

  async deleteSelection() {
    const tokens = this.selectedTokens();
    if (tokens.length === 0) return;

    // One token is cheap to undo by hand; a whole selection is worth a question.
    if (tokens.length > 1) {
      const confirmed = await confirmDialog({
        title: `Delete ${tokens.length} tokens?`,
        confirm: 'Delete',
        danger: true,
      });
      if (!confirmed) return;
    }

    for (const token of tokens) {
      this.sceneRenderer.removeToken(token.tokenId);
      this.socket.emit('removeToken', {
        sceneId: this.sceneRenderer.sceneId,
        tokenId: token.tokenId,
      });
    }
    this.setSelection([]);
  }

  // --- View ---

  toggleToolbar() {
    document.body.classList.toggle('toolbar-hidden');
  }

  toggleMusic() {
    document.body.classList.toggle('music-hidden');
  }

  toggleHelp() {
    const dialog = document.getElementById('help-dialog');
    if (dialog.open) dialog.close();
    else dialog.showModal();
  }

  // --- Keyboard ---

  onKeyDown(event) {
    // Never steal a keystroke that belongs to a form control or an open dialog.
    const { target } = event;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (document.querySelector('dialog[open]') && event.key !== '?') return;

    // Arrows repeat and take a modifier, so they sit outside the command table.
    const step = NUDGE * (event.shiftKey ? NUDGE_BOOST : 1);
    const nudge = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];

    if (nudge) {
      if (this.selection.size === 0) return;
      event.preventDefault();
      this.nudgeSelection(...nudge);
      return;
    }

    const combo = comboFor(event);
    const command = COMMANDS.find((entry) => !entry.doc && entry.key === combo);
    if (!command) return;
    if (command.needsSelection && this.selection.size === 0) return;

    event.preventDefault(); // Ctrl+D would otherwise bookmark the page
    command.run(this);
  }

  // --- Dropping media ---

  async onDrop(event) {
    event.preventDefault();

    if (!this.sceneRenderer.sceneId) {
      return toast('Load or create a scene before adding tokens.', 'error');
    }

    // Measured now, because the drop position is gone by the time uploads finish.
    const { x, y } = this.sceneRenderer.screenToWorld(event.clientX, event.clientY);

    const added = [];
    for (const file of event.dataTransfer.files) {
      const tokenId = await this.addDroppedFile(file, x, y);
      if (tokenId) added.push(tokenId);
    }
    if (added.length > 0) this.setSelection(added);
  }

  async addDroppedFile(file, x, y) {
    const body = new FormData();
    body.append('file', file);

    try {
      const response = await fetch('/upload', { method: 'POST', body });
      const { imageUrl, mediaType, message } = await response.json();
      if (!response.ok) throw new Error(message);

      const { width, height } = await mediaSize(imageUrl, mediaType);
      const token = {
        tokenId: newTokenId(),
        imageUrl,
        mediaType,
        x,
        y,
        width,
        height,
        rotation: 0,
        zIndex: this.maxZIndex() + 1,
        hidden: false,
        movableByPlayers: false,
        name: file.name.replace(/\.[^.]+$/, ''),
      };

      this.addToken(token);
      return token.tokenId;
    } catch (err) {
      console.error(`Could not add ${file.name}:`, err.message);
      toast(`Could not add "${file.name}".`, 'error');
      return null;
    }
  }

  maxZIndex() {
    return this.sceneRenderer.tokens.reduce((max, token) => Math.max(max, token.zIndex), 0);
  }
}
