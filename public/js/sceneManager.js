// public/js/sceneManager.js

const MAX_TOKEN_DIMENSION = 200;
const SELECTION_SHADOW = '0px 0px 10px 3px #222222';

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
    this.selectedTokenId = null;
    this.buttonsContainer = document.getElementById('scene-buttons-container');

    this.listenToServer();
    this.listenToInput();
  }

  // --- Server ---
  // The scene list and the scene itself are both pushed; nothing is requested.

  listenToServer() {
    this.socket.on('sceneList', (scenes) => this.renderSceneButtons(scenes));
    this.socket.on('sceneData', (scene) => this.onSceneData(scene));

    this.socket.on('sceneDeleted', ({ sceneId }) => {
      if (this.sceneRenderer.sceneId === sceneId) this.onSceneData(null);
    });

    this.socket.on('addToken', ({ sceneId, token }) => {
      if (this.sceneRenderer.sceneId !== sceneId) return;
      this.sceneRenderer.addToken(token);
      this.attachToken(token);
    });

    this.socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
      if (this.sceneRenderer.sceneId !== sceneId) return;

      const token = this.sceneRenderer.tokenFor(tokenId);
      if (!token) return;

      Object.assign(token, properties);
      this.sceneRenderer.updateTokenElement(token);
      this.tokenManager.setupTokenInteractions(token);
    });

    this.socket.on('removeToken', ({ sceneId, tokenId }) => {
      if (this.sceneRenderer.sceneId !== sceneId) return;
      if (this.selectedTokenId === tokenId) this.selectedTokenId = null;
      this.sceneRenderer.removeToken(tokenId);
    });
  }

  listenToInput() {
    this.sceneContainer.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      this.sceneContainer.classList.add('dragover');
    });
    this.sceneContainer.addEventListener('dragleave', () =>
      this.sceneContainer.classList.remove('dragover')
    );
    this.sceneContainer.addEventListener('drop', (event) => this.onDrop(event));

    // Clicking the background clears the selection.
    this.sceneContainer.addEventListener('click', (event) => {
      if (event.target === this.sceneContainer) this.select(null);
    });

    document.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  // --- Scenes ---

  renderSceneButtons(scenes) {
    this.buttonsContainer.replaceChildren(
      ...scenes.map((scene) => {
        const button = document.createElement('button');
        button.className = 'scene-button';
        button.textContent = scene.sceneName;
        button.dataset.sceneId = scene.sceneId;
        button.classList.toggle('active', scene.sceneId === this.sceneRenderer.sceneId);
        button.addEventListener('click', () =>
          this.socket.emit('changeScene', { sceneId: scene.sceneId })
        );
        return button;
      })
    );

    this.sortable ??= new Sortable(this.buttonsContainer, {
      animation: 150,
      onEnd: () => {
        const buttons = this.buttonsContainer.querySelectorAll('.scene-button');
        const sceneOrder = [...buttons].map((button) => button.dataset.sceneId);
        this.socket.emit('reorderScenes', { sceneOrder });
      },
    });
  }

  onSceneData(scene) {
    this.selectedTokenId = null;

    if (!scene) {
      this.sceneRenderer.clear();
    } else {
      this.sceneRenderer.renderScene(scene);
      scene.tokens.forEach((token) => this.attachToken(token));
    }

    for (const button of this.buttonsContainer.querySelectorAll('.scene-button')) {
      button.classList.toggle('active', button.dataset.sceneId === this.sceneRenderer.sceneId);
    }
  }

  createScene(sceneName) {
    this.socket.emit('createScene', { sceneName });
  }

  deleteCurrentScene() {
    if (!this.sceneRenderer.sceneId) return alert('No scene is currently loaded.');
    if (!confirm('Delete the current scene? This cannot be undone.')) return;

    this.socket.emit('deleteScene', { sceneId: this.sceneRenderer.sceneId });
  }

  // --- Tokens ---

  attachToken(token) {
    this.tokenManager.setupTokenInteractions(token);

    const element = document.getElementById(`token-${token.tokenId}`);
    element?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.select(token.tokenId);
    });
  }

  select(tokenId) {
    const previous = document.getElementById(`token-${this.selectedTokenId}`);
    if (previous) previous.style.boxShadow = '';

    this.selectedTokenId = tokenId;
    const element = document.getElementById(`token-${tokenId}`);
    if (element) element.style.boxShadow = SELECTION_SHADOW;
  }

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
    this.attachToken(token);
    this.socket.emit('addToken', { sceneId: this.sceneRenderer.sceneId, token });
  }

  deleteToken(token) {
    this.sceneRenderer.removeToken(token.tokenId);
    this.selectedTokenId = null;
    this.socket.emit('removeToken', {
      sceneId: this.sceneRenderer.sceneId,
      tokenId: token.tokenId,
    });
  }

  duplicateToken(token) {
    const copy = { ...token, tokenId: newTokenId() };
    copy.x += 20;
    copy.y += 20;
    copy.zIndex += 1;

    this.addToken(copy);
    this.select(copy.tokenId);
  }

  /** Swap a token past its neighbour in the stack. */
  moveTokenZIndex(token, direction) {
    const stack = [...this.sceneRenderer.tokens].sort((a, b) => a.zIndex - b.zIndex);
    const index = stack.indexOf(token);
    const neighbour = stack[index + direction];
    if (index === -1 || !neighbour) return;

    const zIndex = token.zIndex;
    this.updateToken(token, { zIndex: neighbour.zIndex });
    this.updateToken(neighbour, { zIndex });
  }

  toggleMovable(token) {
    this.updateToken(token, { movableByPlayers: !token.movableByPlayers });
    this.tokenManager.setupTokenInteractions(token); // redraws the player-movable border
  }

  // --- Keyboard ---

  onKeyDown(event) {
    // Never steal a keystroke that belongs to a form control.
    const { target } = event;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 't') {
      document.body.classList.toggle('toolbar-hidden');
      return;
    }
    if (key === 'm') {
      document.body.classList.toggle('music-hidden');
      return;
    }
    if (event.shiftKey && key === 'd') {
      this.deleteCurrentScene();
      return;
    }

    const token = this.sceneRenderer.tokenFor(this.selectedTokenId);
    if (!token) return;

    if (event.ctrlKey && key === 'd') {
      event.preventDefault(); // Chrome bookmarks the page otherwise
      this.duplicateToken(token);
    } else if (event.key === ']') {
      this.moveTokenZIndex(token, 1);
    } else if (event.key === '[') {
      this.moveTokenZIndex(token, -1);
    } else if (key === 'h') {
      this.updateToken(token, { hidden: !token.hidden });
    } else if (key === 'i') {
      this.toggleMovable(token);
    } else if (event.key === 'Delete') {
      this.deleteToken(token);
    }
  }

  // --- Dropping media ---

  async onDrop(event) {
    event.preventDefault();
    this.sceneContainer.classList.remove('dragover');

    if (!this.sceneRenderer.sceneId) return alert('Please load or create a scene first.');

    // Measured now, because the drop position is gone by the time uploads finish.
    const { x, y } = this.sceneRenderer.screenToWorld(event.clientX, event.clientY);

    for (const file of event.dataTransfer.files) {
      await this.addDroppedFile(file, x, y);
    }
  }

  async addDroppedFile(file, x, y) {
    const body = new FormData();
    body.append('file', file);

    try {
      const response = await fetch('/upload', { method: 'POST', body });
      const { imageUrl, mediaType, message } = await response.json();
      if (!response.ok) throw new Error(message);

      const { width, height } = await mediaSize(imageUrl, mediaType);

      this.addToken({
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
      });
    } catch (err) {
      console.error(`Could not add ${file.name}:`, err.message);
      alert(`Failed to add "${file.name}".`);
    }
  }

  maxZIndex() {
    return this.sceneRenderer.tokens.reduce((max, token) => Math.max(max, token.zIndex), 0);
  }
}
