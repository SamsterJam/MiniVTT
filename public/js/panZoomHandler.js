// public/js/panZoomHandler.js

export class PanZoomHandler {
  constructor(container, sceneRenderer) {
    this.container = container;
    this.sceneRenderer = sceneRenderer;
    this.scale = sceneRenderer.scale;
    this.offsetX = sceneRenderer.offsetX;
    this.offsetY = sceneRenderer.offsetY;

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
    const mouseSceneX = (mouseX / this.scale) - this.offsetX;
    const mouseSceneY = (mouseY / this.scale) - this.offsetY;

    // Adjust the scale
    const baseZoomIntensity = 0.0005; // Base zoom intensity
    // Adjust intensity proportionally to current scale
    const zoomIntensity = baseZoomIntensity * this.scale; // Multiply by scale

    const delta = event.deltaY;
    const zoom = Math.exp(-delta * zoomIntensity);

    this.scale *= zoom;
    // Limit to reasonable bounds
    this.scale = Math.min(Math.max(this.scale, 0.5), 5);

    // After adjusting the scale, recalculate the offsets so that the mouse scene position stays under the mouse pointer
    this.offsetX = (mouseX / this.scale) - mouseSceneX;
    this.offsetY = (mouseY / this.scale) - mouseSceneY;

    // Update the scene renderer's scale and offset
    this.sceneRenderer.scale = this.scale;
    this.sceneRenderer.offsetX = this.offsetX;
    this.sceneRenderer.offsetY = this.offsetY;

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
      const deltaX = (event.clientX - this.startX) / this.scale;
      const deltaY = (event.clientY - this.startY) / this.scale;

      this.offsetX += deltaX;
      this.offsetY += deltaY;

      this.startX = event.clientX;
      this.startY = event.clientY;

      // Update the scene renderer's offset
      this.sceneRenderer.offsetX = this.offsetX;
      this.sceneRenderer.offsetY = this.offsetY;

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