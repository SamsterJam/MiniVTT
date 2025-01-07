// public/js/panZoomHandler.js

export class PanZoomHandler {
  constructor(container, sceneRenderer) {
    this.container = container;
    this.sceneRenderer = sceneRenderer;

    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Zooming with mouse wheel
    this.container.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });

    // Panning with middle mouse button
    this.container.addEventListener('mousedown', (event) => this.onMouseDown(event));
    document.addEventListener('mousemove', (event) => this.onMouseMove(event));
    document.addEventListener('mouseup', (event) => this.onMouseUp(event));
  }

  onWheel(event) {
    event.preventDefault();

    const rect = this.container.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate the mouse position in scene (world) coordinates before scaling
    const mouseSceneX = (mouseX / this.sceneRenderer.scale) - this.sceneRenderer.offsetX;
    const mouseSceneY = (mouseY / this.sceneRenderer.scale) - this.sceneRenderer.offsetY;

    // Adjust the scale
    const baseZoomIntensity = 0.0003; // Base zoom intensity
    // Adjust intensity proportionally to current scale
    const zoomIntensity = baseZoomIntensity * this.sceneRenderer.scale; // Multiply by scale

    const delta = event.deltaY;
    const zoom = Math.exp(-delta * zoomIntensity);

    this.sceneRenderer.scale *= zoom;
    // Limit to reasonable bounds
    this.sceneRenderer.scale = Math.min(Math.max(this.sceneRenderer.scale, 0.8), 5);

    // After adjusting the scale, recalculate the offsets so that the mouse scene position stays under the mouse pointer
    this.sceneRenderer.offsetX = (mouseX / this.sceneRenderer.scale) - mouseSceneX;
    this.sceneRenderer.offsetY = (mouseY / this.sceneRenderer.scale) - mouseSceneY;

    // Update all token positions
    this.sceneRenderer.updateAllTokenElements();
  }

  onMouseDown(event) {
    if (event.button === 1) {
      // Middle mouse button
      this.isPanning = true;
      this.startX = event.clientX;
      this.startY = event.clientY;
      event.preventDefault(); // Prevent default middle mouse behavior
    }
  }

  onMouseMove(event) {
    if (this.isPanning) {
      const deltaX = (event.clientX - this.startX) / this.sceneRenderer.scale;
      const deltaY = (event.clientY - this.startY) / this.sceneRenderer.scale;

      this.sceneRenderer.offsetX += deltaX;
      this.sceneRenderer.offsetY += deltaY;

      this.startX = event.clientX;
      this.startY = event.clientY;

      // Update all token positions
      this.sceneRenderer.updateAllTokenElements();
    }
  }

  onMouseUp(event) {
    if (event.button === 1 && this.isPanning) { // Middle mouse button
      this.isPanning = false;
      event.preventDefault();
    }
  }
}