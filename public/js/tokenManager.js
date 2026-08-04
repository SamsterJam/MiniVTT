// public/js/tokenManager.js
import { throttle } from './utils.js';

const MIN_TOKEN_SIZE = 8;

// Live enough for the table, without a dozen dragged tokens flooding the wire.
const SEND_INTERVAL = 40;

// How far the pointer may travel before a press stops counting as a click.
const CLICK_SLOP = 3;

export class TokenManager {
  constructor(sceneRenderer, socket, isDM = false) {
    this.sceneRenderer = sceneRenderer;
    this.socket = socket;
    this.isDM = isDM;

    // A drag and a click arrive as the same events; this tells them apart.
    this.pointerTravel = 0;

    // Tokens that travel with the dragged one. SceneManager widens this to the
    // whole selection.
    this.selectionFor = (token) => [token];

    // Positions mutate in place, so the trailing call sends the final ones.
    this.sendMoves = throttle((tokens) => {
      for (const token of tokens) this.emit(token, { x: token.x, y: token.y });
    }, SEND_INTERVAL);

    this.sendResize = throttle((token) => {
      this.emit(token, { x: token.x, y: token.y, width: token.width, height: token.height });
    }, SEND_INTERVAL);

    // Reset per press, not on interact's dragstart: that only fires once the
    // pointer has travelled, so a click would inherit the last drag's distance.
    document.addEventListener('pointerdown', () => {
      this.pointerTravel = 0;
    });
  }

  emit(token, properties) {
    this.socket.emit('updateToken', {
      sceneId: this.sceneRenderer.sceneId,
      tokenId: token.tokenId,
      properties,
    });
  }

  setupTokenInteractions(token) {
    if (!this.isDM && token.hidden) return;

    const element = this.sceneRenderer.elementFor(token.tokenId);
    if (!element) return;

    // Rebuilt whenever a token changes, so the old set goes first. Hover is
    // left to CSS, which cannot accumulate the way listeners do.
    interact(element).unset();

    const interactive = this.isDM || token.movableByPlayers;
    element.classList.toggle('is-interactive', interactive);
    if (!interactive) return;

    interact(element).draggable({
      onmove: (event) => this.onDragMove(event, token),
    });

    if (!this.isDM) return;

    interact(element)
      .resizable({ edges: { top: true, right: true, bottom: true, left: true }, margin: 6 })
      .on('resizestart', (event) => {
        token.initialAspectRatio = event.rect.width / event.rect.height;
      })
      .on('resizemove', (event) => this.onResizeMove(event, token));
  }

  onDragMove(event, token) {
    this.pointerTravel += Math.hypot(event.dx, event.dy);

    // Pointer deltas arrive in screen pixels; tokens live in world units.
    const dx = event.dx / this.sceneRenderer.scale;
    const dy = event.dy / this.sceneRenderer.scale;

    const moving = this.selectionFor(token);
    for (const moved of moving) {
      moved.x += dx;
      moved.y += dy;
      this.sceneRenderer.updateTokenElement(moved);
    }

    this.sendMoves(moving);
  }

  onResizeMove(event, token) {
    this.pointerTravel += Math.hypot(event.dx, event.dy);
    const { scale } = this.sceneRenderer;

    let deltaWidth = event.deltaRect.width / scale;
    let deltaHeight = event.deltaRect.height / scale;

    // Hold Shift to stretch a token out of its natural proportions.
    if (!event.shiftKey) {
      const aspectRatio = token.initialAspectRatio;
      if (Math.abs(deltaWidth) > Math.abs(deltaHeight)) deltaHeight = deltaWidth / aspectRatio;
      else deltaWidth = deltaHeight * aspectRatio;
    }

    // The server rejects non-positive sizes, so never send one.
    token.width = Math.max(MIN_TOKEN_SIZE, token.width + deltaWidth);
    token.height = Math.max(MIN_TOKEN_SIZE, token.height + deltaHeight);

    token.x += event.deltaRect.left / scale;
    token.y += event.deltaRect.top / scale;

    this.sceneRenderer.updateTokenElement(token);
    this.sendResize(token);
  }

  /** Whether the gesture that just ended was a click rather than a drag. */
  wasClick() {
    return this.pointerTravel <= CLICK_SLOP;
  }
}
