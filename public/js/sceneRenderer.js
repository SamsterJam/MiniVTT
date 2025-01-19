// public/js/sceneRenderer.js
import { extractDominantColor } from './utils.js';

export class SceneRenderer {
  constructor(container, isDM = false) {
    this.container = container;
    this.isDM = isDM;
    this.tokens = [];
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  renderScene(scene) {
    this.resetCamera();
    this.container.innerHTML = ''; // Clear existing content
  
    // For DM, include all tokens; for players, include only visible tokens
    if (this.isDM) {
      this.tokens = scene.tokens;
    } else {
      this.tokens = scene.tokens.filter(token => !token.hidden);
    }
  
    // Sort tokens by zIndex
    this.tokens.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  
    // Render tokens
    this.tokens.forEach((token) => {
      this.renderToken(token);
    });
  
    // Adjust background color based on tokens
    this.setBackgroundBasedOnTokens();
  }

  renderToken(token) {
    if (!this.isDM && token.hidden) {
      return;
    }

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
    element.style.zIndex = token.zIndex || 0;
    element.dataset.tokenId = token.tokenId;

    if (this.isDM && token.hidden) {
      element.style.opacity = '0.5';
    }

    // Disable default browser dragging
    element.draggable = false;

    this.container.appendChild(element);

    // Optionally, you can return the element if needed
    return element;
  }

  // Update all token elements
  updateAllTokenElements() {
    this.tokens.forEach((token) => {
      if (!this.isDM && token.hidden) return; // Skip hidden tokens for players
      this.updateTokenElement(token);
    });
  }

  // Update a single token element's position and size
  updateTokenElement(token) {
    const element = document.getElementById(`token-${token.tokenId}`);
  
    if (!this.isDM && token.hidden) {
      if (element && element.parentNode === this.container) {
        this.container.removeChild(element);
      }
      return;
    }
  
    if (element) {
      // Update element style
      element.style.left = `${(token.x + this.offsetX) * this.scale}px`;
      element.style.top = `${(token.y + this.offsetY) * this.scale}px`;
      element.style.width = `${token.width * this.scale}px`;
      element.style.height = `${token.height * this.scale}px`;
      element.style.transform = `rotate(${token.rotation}deg)`;
      element.style.zIndex = token.zIndex || 0;
  
      if (this.isDM && token.hidden) {
        element.style.opacity = '0.5';
      } else {
        element.style.opacity = '1';
      }
    } else if (!token.hidden || this.isDM) {
      // Token element doesn't exist, create it if it's not hidden
      this.renderToken(token);
      // Optionally set up token interactions
    }
  }

  resetCamera() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  // Adjust background color based on the largest token (image or video)
  setBackgroundBasedOnTokens() {
    // Find the largest token by area, regardless of whether it's an image or video
    let largestToken = null;
    if (this.tokens.length > 0) {
      largestToken = this.tokens.reduce((prev, current) => {
        return prev.width * prev.height > current.width * current.height ? prev : current;
      });
    }

    if (largestToken) {
      if (largestToken.mediaType !== 'video') {
        // If the largest token is an image, extract the dominant color from the image
        extractDominantColor(largestToken.imageUrl)
          .then((color) => {
            // Set the background color of the scene container
            this.container.style.backgroundColor = color;
          })
          .catch((err) => {
            console.error('Error extracting dominant color for image:', err);
          });
      } else {
        // If the largest token is a video, create a temporary video element to extract the first frame
        const video = document.createElement('video');
        video.src = largestToken.imageUrl;
        video.crossOrigin = 'Anonymous'; // May be needed for CORS
        video.muted = true; // Mute the video to avoid autoplay issues
    
        // Set up an event listener for when the video is ready to play
        video.oncanplay = () => {
          // Play the video briefly to make sure we get a non-black frame
          video.play();
    
          // Wait a short amount of time (e.g., 1 second) to allow the video to display
          setTimeout(() => {
            // Create a canvas to capture the first visible frame
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
    
            // Ensure the canvas matches the video size
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
    
            // Draw the current frame of the video onto the canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
            // Get the pixel data from the canvas (top-left corner)
            const imageData = ctx.getImageData(0, 0, 1, 1); // Get the color of the top-left pixel
            const [r, g, b] = imageData.data;
    
            // Format the color as an RGB string
            const dominantColor = `rgb(${r},${g},${b})`;
    
            // Set the background color of the scene container
            this.container.style.backgroundColor = dominantColor;
    
            // Pause the video after capturing the frame
            video.pause();
          }, 1000); // 1 second delay before capturing the frame
        };
    
        // Start loading the video
        video.load();
      }
    }
  }
}