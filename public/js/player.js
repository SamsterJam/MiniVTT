// public/js/player.js

const socket = io();

socket.on('connect', () => {
  console.log('Connected to server');
});

let currentScene = null;

const sceneContainer = document.getElementById('scene-container');

// Initialize variables for pan and zoom
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Function to update all token elements
function updateAllTokenElements() {
  if (!currentScene) return;
  currentScene.tokens.forEach(token => {
    updateTokenElement(token);
  });
}

// Function to update a single token element's position and size
function updateTokenElement(token) {
  const element = document.getElementById(`token-${token.tokenId}`);
  if (element) {
    element.style.left = `${(token.x + offsetX) * scale}px`;
    element.style.top = `${(token.y + offsetY) * scale}px`;
    element.style.width = `${token.width * scale}px`;
    element.style.height = `${token.height * scale}px`;
    element.style.transform = `rotate(${token.rotation}deg)`;
  }
}

// Zooming with mouse wheel
sceneContainer.addEventListener('wheel', function(event) {
  event.preventDefault();

  const rect = sceneContainer.getBoundingClientRect();

  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // Calculate the mouse position in scene (world) coordinates before scaling
  const mouseSceneX = (mouseX / scale) - offsetX;
  const mouseSceneY = (mouseY / scale) - offsetY;

  // Adjust the scale
  const baseZoomIntensity = 0.0005; // Base zoom intensity
  // Adjust intensity proportionally to current scale
  const zoomIntensity = baseZoomIntensity * scale; // Multiply by scale

  const delta = event.deltaY;
  const zoom = Math.exp(-delta * zoomIntensity);

  scale *= zoom;
  // Limit to reasonable bounds
  scale = Math.min(Math.max(scale, 0.1), 5);

  // After adjusting the scale, recalculate the offsets so that the mouse scene position stays under the mouse pointer
  offsetX = (mouseX / scale) - mouseSceneX;
  offsetY = (mouseY / scale) - mouseSceneY;

  // Update all token positions
  updateAllTokenElements();
}, { passive: false });

// Panning with middle mouse button
let isPanning = false;
let startX = 0;
let startY = 0;

sceneContainer.addEventListener('mousedown', function(event) {
  if (event.button === 1) { // Middle mouse button
    isPanning = true;
    startX = event.clientX;
    startY = event.clientY;
    event.preventDefault(); // Prevent default middle mouse behavior
  }
});

document.addEventListener('mousemove', function(event) {
  if (isPanning) {
    const deltaX = (event.clientX - startX) / scale;
    const deltaY = (event.clientY - startY) / scale;

    offsetX += deltaX;
    offsetY += deltaY;

    startX = event.clientX;
    startY = event.clientY;

    // Update all token positions
    updateAllTokenElements();
  }
});

document.addEventListener('mouseup', function(event) {
  if (event.button === 1 && isPanning) { // Middle mouse button
    isPanning = false;
    event.preventDefault();
  }
});

// Get the audio element for music playback
const audioElement = document.getElementById('background-music');

// Receive active scene ID from server
socket.on('activeSceneId', (sceneId) => {
  if (sceneId) {
    loadScene(sceneId);
  }
});

// Function to load a scene
function loadScene(sceneId) {
  socket.emit('loadScene', { sceneId: sceneId });
}

// Handle receiving scene data
socket.on('sceneData', (scene) => {
  currentScene = scene;
  renderScene(scene);
});

// Function to render a scene
function renderScene(scene) {
  // Clear existing content
  sceneContainer.innerHTML = '';

  // Render tokens
  scene.tokens.forEach(token => {
    renderToken(token);
  });

  // After rendering tokens, find the largest image token by area
  const imageTokens = scene.tokens.filter(token => token.mediaType !== 'video');

  if (imageTokens.length > 0) {
    let largestImageToken = imageTokens.reduce((prev, current) => {
      return (prev.width * prev.height > current.width * current.height) ? prev : current;
    });

    // Extract the dominant color from the largest image token
    extractDominantColor(largestImageToken.imageUrl).then(color => {
      // Set the background color of the scene container
      sceneContainer.style.backgroundColor = color;
    }).catch(err => {
      console.error('Error extracting dominant color:', err);
    });
  } else {
    // No image tokens found, set default background color
    sceneContainer.style.backgroundColor = ''; // Or set a specific color
  }

  // Update all token elements to adjust for current scale and offsets
  updateAllTokenElements();
}

// Function to render a token
function renderToken(token) {
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
  element.style.position = 'absolute';

  // Calculate displayed positions and sizes
  element.style.left = `${(token.x + offsetX) * scale}px`;
  element.style.top = `${(token.y + offsetY) * scale}px`;
  element.style.width = `${token.width * scale}px`;
  element.style.height = `${token.height * scale}px`;
  element.style.transform = `rotate(${token.rotation}deg)`;
  element.dataset.tokenId = token.tokenId;

  // Disable default browser dragging
  element.draggable = false;

  sceneContainer.appendChild(element);

  // Make the token draggable if movableByPlayers is true
  if (token.movableByPlayers) {
    setupDraggable(element, token.movableByPlayers);
  }

  // Add hover shadow effect
  toggleHoverShadow(token.tokenId, token.movableByPlayers);
}

// Function to setup draggable interaction
function setupDraggable(element, enable) {
  // Unset any existing interactions
  interact(element).unset();

  if (enable) {
    interact(element)
      .draggable({
        onmove: onTokenDragMove,
        modifiers: [
          // Restrict movement within the scene container
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ]
      });
  }
}

// Event handler for token drag (players)
function onTokenDragMove(event) {
  const target = event.target;
  const tokenId = target.dataset.tokenId;

  // Calculate new position in base coordinates
  const deltaX = event.dx / scale;
  const deltaY = event.dy / scale;

  const token = currentScene.tokens.find(t => t.tokenId === tokenId);
  if (token) {
    token.x += deltaX;
    token.y += deltaY;

    // Update element style
    target.style.left = `${(token.x + offsetX) * scale}px`;
    target.style.top = `${(token.y + offsetY) * scale}px`;

    // Send update to server
    socket.emit('updateToken', {
      sceneId: currentScene.sceneId,
      tokenId: tokenId,
      properties: { x: token.x, y: token.y }
    });
  }
}

// Handle token updates from the server
socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
  if (currentScene.sceneId !== sceneId) return;

  const token = currentScene.tokens.find(t => t.tokenId === tokenId);
  if (token) {
    // Update token properties
    Object.assign(token, properties);

    // Update the DOM element
    updateTokenElement(token);

    // Setup draggable interaction
    const element = document.getElementById(`token-${tokenId}`);
    if (element) {
      setupDraggable(element, token.movableByPlayers);
    }

    // Update visual appearance of token if draggable to have hover shadow
    toggleHoverShadow(tokenId, token.movableByPlayers);
  }
});

socket.on('addToken', ({ sceneId, token }) => {
  if (currentScene.sceneId !== sceneId) return;

  // Add the new token to the scene's token list
  currentScene.tokens.push(token);

  // Render the new token
  renderToken(token);
});

socket.on('removeToken', ({ sceneId, tokenId }) => {
  console.log('removeToken', sceneId, tokenId);
  if (currentScene.sceneId !== sceneId) return;

  const tokenIndex = currentScene.tokens.findIndex(t => t.tokenId === tokenId);
  if (tokenIndex !== -1) {
    // Remove from currentScene.tokens
    currentScene.tokens.splice(tokenIndex, 1);
    // Remove from DOM
    const element = document.getElementById(`token-${tokenId}`);
    if (element && element.parentNode === sceneContainer) {
      sceneContainer.removeChild(element);
    }
  }
});

// === Utility Functions ===

// Function to extract the dominant color from an image
function extractDominantColor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // May be needed if images are served from a different origin
    img.src = imageUrl;

    img.onload = function () {
      // Create a canvas to draw the image
      const canvas = document.createElement('canvas');
      canvas.width = 1; // Reduce size for performance
      canvas.height = 1;

      const ctx = canvas.getContext('2d');

      // Draw the image scaled down to 1x1 pixel
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Get the pixel data from the canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Extract the color from the single pixel
      const [r, g, b] = data;

      // Format the color as an RGB string
      const dominantColor = `rgb(${r},${g},${b})`;

      resolve(dominantColor);
    };

    img.onerror = function () {
      reject("Image loading error");
    };
  });
}

// Function to enable or disable hover shadow on tokens
function toggleHoverShadow(tokenId, enable) {
  const element = document.getElementById(`token-${tokenId}`);
  if (element) {
    element.addEventListener('mouseenter', () => {
      element.style.boxShadow = enable ? '0 0 16px 5px rgba(0,0,0,0.25)' : 'none';
    });

    element.addEventListener('mouseleave', () => {
      element.style.boxShadow = 'none';
    });
  }
}

// Keep track of whether audio has been enabled by the user
let audioEnabled = false;
let currentMusicData = null; // Keep track of the current music data

const enableAudioButton = document.getElementById('enable-audio-button');

// Handle music control events
socket.on('playMusic', (data) => {
  currentMusicData = data;

  if (audioEnabled) {
    if (audioElement.src !== data.musicUrl) {
      audioElement.src = data.musicUrl;
    }
    audioElement.currentTime = data.currentTime || 0;
    audioElement.play().catch((error) => {
      console.error('Error playing audio:', error);
    });
  } else {
    enableAudioButton.style.display = 'block';
  }
});

socket.on('pauseMusic', (data) => {
  currentMusicData = null; // No music is playing
  if (audioEnabled) {
    audioElement.pause();
    audioElement.currentTime = data.currentTime;
  }
});

socket.on('stopMusic', () => {
  currentMusicData = null; // No music is playing
  if (audioEnabled) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
});

// Handle volume change events from the server
socket.on('setVolume', (data) => {
  audioElement.volume = data.volume;
});

enableAudioButton.addEventListener('click', () => {
  audioEnabled = true;
  enableAudioButton.style.display = 'none';

  // Hide the audio overlay if applicable
  const audioOverlay = document.getElementById('audio-overlay');
  if (audioOverlay) {
    audioOverlay.style.display = 'none';
  }

  // Attempt to play music if music data is available
  if (currentMusicData) {
    // Only set src if it's different
    if (audioElement.src !== currentMusicData.musicUrl) {
      audioElement.src = currentMusicData.musicUrl;
    }
    audioElement.currentTime = currentMusicData.currentTime || 0;

    audioElement.play().catch((error) => {
      console.error('Error playing audio after enabling:', error);
    });
  }
});