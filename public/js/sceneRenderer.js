// public/js/sceneRenderer.js
import { extractDominantColor } from './utils.js';

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

export class SceneRenderer {
  constructor(container, isDM = false) {
    this.container = container;
    this.isDM = isDM;
    this.sceneId = null;
    this.tokens = [];

    // Camera, in world units.
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Tokens are laid out once in world coordinates and share this parent, so
    // the camera is one composited transform rather than a write per token.
    this.world = document.createElement('div');
    this.world.className = 'world';
    this.container.appendChild(this.world);
    this.applyCamera();
  }

  // --- Camera ---

  applyCamera() {
    // Read right to left: translate in world units, then scale the result.
    this.world.style.transform =
      `scale(${this.scale}) translate(${this.offsetX}px, ${this.offsetY}px)`;
  }

  resetCamera() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.applyCamera();
  }

  /** Pan by a distance measured in screen pixels. */
  panBy(screenDX, screenDY) {
    this.offsetX += screenDX / this.scale;
    this.offsetY += screenDY / this.scale;
    this.applyCamera();
  }

  /** Where a client-space point falls in the scene. */
  screenToWorld(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale - this.offsetX,
      y: (clientY - rect.top) / this.scale - this.offsetY,
    };
  }

  /** Zoom about a client-space point, keeping whatever is under it in place. */
  zoomAt(clientX, clientY, factor) {
    const { x: worldX, y: worldY } = this.screenToWorld(clientX, clientY);

    // Derived from the old camera, so the container is only measured once.
    const screenX = (worldX + this.offsetX) * this.scale;
    const screenY = (worldY + this.offsetY) * this.scale;

    this.scale = Math.min(Math.max(this.scale * factor, MIN_SCALE), MAX_SCALE);

    this.offsetX = screenX / this.scale - worldX;
    this.offsetY = screenY / this.scale - worldY;
    this.applyCamera();
  }

  // --- Tokens ---

  renderScene(scene) {
    this.resetCamera();
    this.clear();
    this.sceneId = scene.sceneId;

    // For DM, include all tokens; for players, include only visible tokens
    if (this.isDM) {
      this.tokens = scene.tokens;
    } else {
      this.tokens = scene.tokens.filter((token) => !token.hidden);
    }

    this.tokens.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    this.tokens.forEach((token) => this.renderToken(token));

    this.setBackgroundBasedOnTokens();
  }

  clear() {
    this.world.replaceChildren();
    this.container.querySelector('.instructions')?.remove();
  }

  renderToken(token) {
    if (!this.isDM && token.hidden) return null;

    let element;
    if (token.mediaType === 'video') {
      element = document.createElement('video');
      element.src = token.imageUrl;
      element.autoplay = true;
      element.loop = true;
      element.muted = true; // Muted due to browser autoplay policies
    } else {
      element = document.createElement('img');
      element.src = token.imageUrl;
    }

    element.id = `token-${token.tokenId}`;
    element.className = 'token';
    element.dataset.tokenId = token.tokenId;
    element.draggable = false; // Disable default browser dragging

    this.world.appendChild(element);
    this.updateTokenElement(token);
    return element;
  }

  /** Write a token's world-space geometry. The camera is not involved. */
  updateTokenElement(token) {
    const element = document.getElementById(`token-${token.tokenId}`);

    if (!this.isDM && token.hidden) {
      element?.remove();
      return;
    }

    if (!element) {
      this.renderToken(token);
      return;
    }

    element.style.left = `${token.x}px`;
    element.style.top = `${token.y}px`;
    element.style.width = `${token.width}px`;
    element.style.height = `${token.height}px`;
    element.style.transform = `rotate(${token.rotation || 0}deg)`;
    element.style.zIndex = token.zIndex || 0;
    element.style.opacity = this.isDM && token.hidden ? '0.5' : '1';
  }

  removeTokenElement(tokenId) {
    document.getElementById(`token-${tokenId}`)?.remove();
  }

  /** Tint the backdrop from the largest token, so a map blends into the page. */
  setBackgroundBasedOnTokens() {
    if (this.tokens.length === 0) return;

    const largest = this.tokens.reduce((prev, current) =>
      prev.width * prev.height > current.width * current.height ? prev : current
    );

    if (largest.mediaType !== 'video') {
      extractDominantColor(largest.imageUrl)
        .then((color) => {
          this.container.style.backgroundColor = color;
        })
        .catch((err) => {
          console.error('Error extracting dominant color for image:', err);
        });
      return;
    }

    // A video has no still to sample, so play a frame into a canvas and read it.
    const video = document.createElement('video');
    video.src = largest.imageUrl;
    video.crossOrigin = 'Anonymous';
    video.muted = true;

    video.oncanplay = () => {
      video.play();

      // Let it get past the opening black frame before sampling.
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        this.container.style.backgroundColor = `rgb(${r},${g},${b})`;
        video.pause();
      }, 1000);
    };

    video.load();
  }
}
