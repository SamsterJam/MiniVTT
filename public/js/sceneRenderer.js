// public/js/sceneRenderer.js
import { extractDominantColor } from './utils.js';

export class SceneRenderer {
  constructor(container) {
    this.container = container;
    this.tokens = [];
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  renderScene(scene) {
    this.container.innerHTML = ''; // Clear existing content
    this.tokens = scene.tokens;

    // Render tokens
    this.tokens.forEach((token) => {
      this.renderToken(token);
    });

    // Adjust background color based on tokens
    this.setBackgroundBasedOnTokens();
  }

  renderToken(token) {
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

    // Common properties
    element.id = `token-${token.tokenId}`;
    element.className = 'token';
    element.style.position = 'absolute';
    element.style.left = `${(token.x + this.offsetX) * this.scale}px`;
    element.style.top = `${(token.y + this.offsetY) * this.scale}px`;
    element.style.width = `${token.width * this.scale}px`;
    element.style.height = `${token.height * this.scale}px`;
    element.style.transform = `rotate(${token.rotation}deg)`;
    element.dataset.tokenId = token.tokenId;

    // Disable default browser dragging
    element.draggable = false;

    this.container.appendChild(element);

    // Optionally, you can return the element if needed
    return element;
  }

  // Update all token elements
  updateAllTokenElements() {
    this.tokens.forEach((token) => {
      this.updateTokenElement(token);
    });
  }

  // Update a single token element's position and size
  updateTokenElement(token) {
    const element = document.getElementById(`token-${token.tokenId}`);
    if (element) {
      element.style.left = `${(token.x + this.offsetX) * this.scale}px`;
      element.style.top = `${(token.y + this.offsetY) * this.scale}px`;
      element.style.width = `${token.width * this.scale}px`;
      element.style.height = `${token.height * this.scale}px`;
      element.style.transform = `rotate(${token.rotation}deg)`;
    }
  }

  // Adjust background color based on tokens
  setBackgroundBasedOnTokens() {
    // After rendering tokens, find the largest image token by area
    const imageTokens = this.tokens.filter((token) => token.mediaType !== 'video');

    if (imageTokens.length > 0) {
      let largestImageToken = imageTokens.reduce((prev, current) => {
        return prev.width * prev.height > current.width * current.height ? prev : current;
      });

      // Extract the dominant color from the largest image token
      extractDominantColor(largestImageToken.imageUrl)
        .then((color) => {
          // Set the background color of the scene container
          this.container.style.backgroundColor = color;
        })
        .catch((err) => {
          console.error('Error extracting dominant color:', err);
        });
    } else {
      // No image tokens found, set default background color
      this.container.style.backgroundColor = ''; // Or set a specific color
    }
  }
}