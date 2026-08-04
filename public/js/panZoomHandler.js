// public/js/panZoomHandler.js

// Exponential in wheel delta, with the step growing as you zoom in.
const ZOOM_INTENSITY = 0.00035;

export class PanZoomHandler {
  constructor(container, sceneRenderer) {
    this.container = container;
    this.sceneRenderer = sceneRenderer;

    this.isPanning = false;
    this.lastX = 0;
    this.lastY = 0;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.container.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });

    // Tracked on the document so a pan survives the pointer leaving the container.
    this.container.addEventListener('mousedown', (event) => this.onMouseDown(event));
    document.addEventListener('mousemove', (event) => this.onMouseMove(event));
    document.addEventListener('mouseup', (event) => this.onMouseUp(event));
  }

  onWheel(event) {
    event.preventDefault();
    const intensity = ZOOM_INTENSITY * this.sceneRenderer.scale;
    this.sceneRenderer.zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * intensity));
  }

  onMouseDown(event) {
    if (event.button !== 1) return; // middle mouse button
    this.isPanning = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    event.preventDefault();
  }

  onMouseMove(event) {
    if (!this.isPanning) return;
    this.sceneRenderer.panBy(event.clientX - this.lastX, event.clientY - this.lastY);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  onMouseUp(event) {
    if (event.button !== 1 || !this.isPanning) return;
    this.isPanning = false;
    event.preventDefault();
  }
}
