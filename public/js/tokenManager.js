// public/js/tokenManager.js

export class TokenManager {
  constructor(sceneRenderer, socket, isDM = false) {
    this.sceneRenderer = sceneRenderer;
    this.socket = socket;
    this.isDM = isDM; // Boolean flag to differentiate between DM and player
  }

  setupTokenInteractions(token) {
    const element = document.getElementById(`token-${token.tokenId}`);
    if (!element) return;

    // Unset any existing interactions
    interact(element).unset();

    if (this.isDM || token.movableByPlayers) {
      interact(element)
        .draggable({
          onmove: (event) => this.onDragMove(event, token),
          modifiers: [
            interact.modifiers.restrictRect({
              restriction: 'parent',
              endOnly: true,
            }),
          ],
        });

      if (this.isDM) {
        interact(element)
          .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            invert: 'none',
          })
          .on('resizemove', (event) => this.onResizeMove(event, token));
      }

      // Add hover shadow effect
      this.toggleHoverShadow(token, true);
    } else {
      // If interactions are not allowed, add hover effect without interactions
      this.toggleHoverShadow(token, false);
    }
  }

  onDragMove(event, token) {
    const target = event.target;

    // Calculate new position in base coordinates
    const deltaX = event.dx / this.sceneRenderer.scale;
    const deltaY = event.dy / this.sceneRenderer.scale;

    token.x += deltaX;
    token.y += deltaY;

    // Update element style
    target.style.left = `${(token.x + this.sceneRenderer.offsetX) * this.sceneRenderer.scale}px`;
    target.style.top = `${(token.y + this.sceneRenderer.offsetY) * this.sceneRenderer.scale}px`;

    // Send update to server
    this.socket.emit('updateToken', {
      sceneId: token.sceneId,
      tokenId: token.tokenId,
      properties: { x: token.x, y: token.y },
    });
  }

  onResizeMove(event, token) {
    const target = event.target;

    // Calculate new size in base coordinates
    const deltaWidth = event.deltaRect.width / this.sceneRenderer.scale;
    const deltaHeight = event.deltaRect.height / this.sceneRenderer.scale;

    token.width += deltaWidth;
    token.height += deltaHeight;

    // Optionally adjust position if needed
    const deltaX = event.deltaRect.left / this.sceneRenderer.scale;
    const deltaY = event.deltaRect.top / this.sceneRenderer.scale;

    token.x += deltaX;
    token.y += deltaY;

    // Update element style
    target.style.left = `${(token.x + this.sceneRenderer.offsetX) * this.sceneRenderer.scale}px`;
    target.style.top = `${(token.y + this.sceneRenderer.offsetY) * this.sceneRenderer.scale}px`;
    target.style.width = `${token.width * this.sceneRenderer.scale}px`;
    target.style.height = `${token.height * this.sceneRenderer.scale}px`;

    // Send update to server
    this.socket.emit('updateToken', {
      sceneId: token.sceneId,
      tokenId: token.tokenId,
      properties: {
        x: token.x,
        y: token.y,
        width: token.width,
        height: token.height,
      },
    });
  }

  // Function to enable or disable hover shadow on tokens
  toggleHoverShadow(token, enable) {
    const element = document.getElementById(`token-${token.tokenId}`);
    if (element) {
      element.addEventListener('mouseenter', () => {
        element.style.boxShadow = enable ? '0 0 16px 5px rgba(0,0,0,0.25)' : 'none';
      });

      element.addEventListener('mouseleave', () => {
        element.style.boxShadow = 'none';
      });
    }
  }
}