// public/js/tokenManager.js

const MIN_TOKEN_SIZE = 8;

export class TokenManager {
  constructor(sceneRenderer, socket, isDM = false) {
    this.sceneRenderer = sceneRenderer;
    this.socket = socket;
    this.isDM = isDM; // Boolean flag to differentiate between DM and player
  }

  setupTokenInteractions(token) {
    if (!this.isDM && token.hidden) {
      return;
    }
    const element = document.getElementById(`token-${token.tokenId}`);
    if (!element) return;

    // Unset any existing interactions
    interact(element).unset();

    if (this.isDM || token.movableByPlayers) {
      interact(element)
        .draggable({
          onmove: (event) => this.onDragMove(event, token),
          modifiers: [
            // interact.modifiers.restrictRect({
            //   restriction: 'parent',
            //   endOnly: true,
            // }),
          ],
        });

      if (this.isDM) {
        interact(element)
          .resizable({
            edges: { top: true, right: true, bottom: true, left: true },
            invert: 'none',
            margin: 6,
          })
          .on('resizestart', (event) => {
            // Store the initial aspect ratio
            const rect = event.rect;
            token.initialAspectRatio = rect.width / rect.height;
          })
          .on('resizemove', (event) => {
            this.onResizeMove(event, token);
          });
      }

      // Add hover shadow effect
      this.toggleHoverShadow(token, true);
    } else {
      // If interactions are not allowed, add hover effect without interactions
      this.toggleHoverShadow(token, false);
    }

    if (this.isDM) {
      if (token.movableByPlayers) {
        element.style.border = '2px dashed blue';
      } else {
        element.style.border = '';
      }
    }
  }

  onDragMove(event, token) {
    // Pointer deltas arrive in screen pixels; tokens live in world units.
    token.x += event.dx / this.sceneRenderer.scale;
    token.y += event.dy / this.sceneRenderer.scale;

    this.sceneRenderer.updateTokenElement(token);

    // Send update to server
    this.socket.emit('updateToken', {
      sceneId: this.sceneRenderer.sceneId,
      tokenId: token.tokenId,
      properties: { x: token.x, y: token.y },
    });
  }

  onResizeMove(event, token) {
    const { scale } = this.sceneRenderer;

    let deltaWidth = event.deltaRect.width / scale;
    let deltaHeight = event.deltaRect.height / scale;

    if (!event.shiftKey) {
      // Preserve aspect ratio
      const aspectRatio = token.initialAspectRatio;

      if (Math.abs(deltaWidth) > Math.abs(deltaHeight)) {
        deltaHeight = deltaWidth / aspectRatio;
      } else {
        deltaWidth = deltaHeight * aspectRatio;
      }
    }

    // The server rejects non-positive sizes, so never send one.
    token.width = Math.max(MIN_TOKEN_SIZE, token.width + deltaWidth);
    token.height = Math.max(MIN_TOKEN_SIZE, token.height + deltaHeight);

    // Adjust position if needed
    token.x += event.deltaRect.left / scale;
    token.y += event.deltaRect.top / scale;

    this.sceneRenderer.updateTokenElement(token);

    // Send update to server
    this.socket.emit('updateToken', {
      sceneId: this.sceneRenderer.sceneId,
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
