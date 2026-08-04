// public/js/sceneRenderer.js
import { extractDominantColor } from './utils.js';

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

const GLIDE_FIELDS = ['x', 'y', 'width', 'height', 'rotation'];

// Remote moves arrive as throttled steps; easing into the latest one hides the
// stepping. Time constant in ms, so motion trails by about this much.
const GLIDE_TAU = 30;

// World units left to cover before another frame stops being worth it.
const GLIDE_EPSILON = 0.05;

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

    this.drawn = new Map(); // tokenId -> geometry on screen
    this.targets = new Map(); // tokenId -> geometry it is easing towards
    this.glideFrame = null;

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

    // Token chrome is drawn inside this transform, so it would thicken as the
    // camera moves in. Counter-scaled here, it stays a screen pixel wide.
    this.world.style.setProperty('--px', 1 / this.scale);
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

    this.tokens = this.isDM ? scene.tokens : scene.tokens.filter((token) => !token.hidden);
    this.tokens.sort((a, b) => a.zIndex - b.zIndex);
    this.tokens.forEach((token) => this.renderToken(token));

    this.markEmptiness();
    this.setBackgroundBasedOnTokens();
  }

  /** Show nothing, which also restores the DM's empty state. */
  clear() {
    this.world.replaceChildren();
    this.sceneId = null;
    this.tokens = [];
    this.stopGliding();
    this.markEmptiness();
  }

  /** Drives the empty state: no scene reads differently to an empty one. */
  markEmptiness() {
    this.container.classList.toggle('has-scene', Boolean(this.sceneId));
    this.container.classList.toggle('has-tokens', this.tokens.length > 0);
  }

  tokenFor(tokenId) {
    return this.tokens.find((token) => token.tokenId === tokenId);
  }

  elementFor(tokenId) {
    return document.getElementById(`token-${tokenId}`);
  }

  addToken(token) {
    this.tokens.push(token);
    this.renderToken(token);
    this.markEmptiness();
  }

  removeToken(tokenId) {
    this.tokens = this.tokens.filter((token) => token.tokenId !== tokenId);
    this.elementFor(tokenId)?.remove();
    this.forget(tokenId);
    this.markEmptiness();
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

  /**
   * Write a token's world-space geometry and state. The camera is not involved.
   * Local changes land at once; pass `glide` for ones off the wire.
   */
  updateTokenElement(token, { glide = false } = {}) {
    const element = this.elementFor(token.tokenId);

    if (!this.isDM && token.hidden) {
      element?.remove();
      this.forget(token.tokenId);
      return;
    }

    if (!element) {
      this.renderToken(token);
      return;
    }

    const geometry = {
      x: token.x,
      y: token.y,
      width: token.width,
      height: token.height,
      rotation: token.rotation,
    };

    // Nothing drawn yet is nowhere to glide from, so the first write lands.
    if (glide && this.drawn.has(token.tokenId)) {
      this.targets.set(token.tokenId, geometry);
      this.startGliding();
    } else {
      this.targets.delete(token.tokenId);
      this.drawn.set(token.tokenId, geometry);
      this.drawToken(element, geometry);
    }

    element.style.zIndex = token.zIndex;

    // Classes, not inline styles: the two states would overwrite each other.
    element.classList.toggle('is-hidden', this.isDM && Boolean(token.hidden));

    // DM only; players learn a token is theirs by hovering it.
    element.classList.toggle('is-movable', this.isDM && Boolean(token.movableByPlayers));
  }

  // --- Glide ---
  // Position rides the transform, so a token in motion is composited rather
  // than laying the scene out again every frame.

  drawToken(element, { x, y, width, height, rotation }) {
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
  }

  forget(tokenId) {
    this.drawn.delete(tokenId);
    this.targets.delete(tokenId);
  }

  stopGliding() {
    if (this.glideFrame !== null) cancelAnimationFrame(this.glideFrame);
    this.glideFrame = null;
    this.drawn.clear();
    this.targets.clear();
  }

  startGliding() {
    if (this.glideFrame !== null) return;
    this.lastGlide = performance.now();
    this.glideFrame = requestAnimationFrame((now) => this.stepGlide(now));
  }

  stepGlide(now) {
    // Measured, so the curve is the same at any refresh rate. Capped, so a tab
    // coming back from the background does not jump.
    const elapsed = Math.min(now - this.lastGlide, 100);
    this.lastGlide = now;
    const step = 1 - Math.exp(-elapsed / GLIDE_TAU);

    for (const [tokenId, target] of this.targets) {
      const element = this.elementFor(tokenId);
      const current = this.drawn.get(tokenId);

      // Gone mid-glide.
      if (!element || !current) {
        this.forget(tokenId);
        continue;
      }

      let resting = true;
      for (const field of GLIDE_FIELDS) {
        const distance = target[field] - current[field];
        if (Math.abs(distance) < GLIDE_EPSILON) {
          current[field] = target[field];
          continue;
        }
        current[field] += distance * step;
        resting = false;
      }

      this.drawToken(element, current);
      if (resting) this.targets.delete(tokenId);
    }

    this.glideFrame =
      this.targets.size > 0 ? requestAnimationFrame((next) => this.stepGlide(next)) : null;
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
