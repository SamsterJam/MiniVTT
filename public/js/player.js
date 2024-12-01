// public/js/player.js

const socket = io();

socket.on('connect', () => {
  console.log('Connected to server');
});

let currentScene = null;

const sceneContainer = document.getElementById('scene-container');

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
  sceneContainer.innerHTML = ''; // Clear existing content

  // Render tokens
  scene.tokens.forEach(token => {
    renderToken(token);
  });

  // After rendering tokens, find the largest token by area
  if (scene.tokens.length > 0) {
    let largestToken = scene.tokens.reduce((prev, current) => {
      return (prev.width * prev.height > current.width * current.height) ? prev : current;
    });

    // Extract the dominant color from the largest token's image
    extractDominantColor(largestToken.imageUrl).then(color => {
      // Set the background color of the scene container
      sceneContainer.style.backgroundColor = color;
    }).catch(err => {
      console.error('Error extracting dominant color:', err);
    });
  }
}


// Function to render a token
// Function to render a token
function renderToken(token) {
  const sceneContainer = document.getElementById('scene-container');

  const img = document.createElement('img');
  img.src = token.imageUrl;
  img.id = `token-${token.tokenId}`;
  img.className = 'token';
  img.style.position = 'absolute';
  img.style.left = `${token.x}px`;
  img.style.top = `${token.y}px`;
  img.style.width = `${token.width}px`;
  img.style.height = `${token.height}px`;
  img.style.transform = `rotate(${token.rotation}deg)`;
  img.dataset.tokenId = token.tokenId;

  sceneContainer.appendChild(img);

  // Make the token draggable if movableByPlayers is true
  if (token.movableByPlayers) {
    setupDraggable(img, token.movableByPlayers);
  }

  // Add hover shadow effect
  toggleHoverShadow(token.tokenId, token.movableByPlayers);

  sceneContainer.appendChild(img);
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
          interact.modifiers.restrictRect({
            restriction: sceneContainer,
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

  // Calculate new position
  const deltaX = event.dx;
  const deltaY = event.dy;

  // Update the actual position properties
  const newLeft = (parseFloat(target.style.left) || 0) + deltaX;
  const newTop = (parseFloat(target.style.top) || 0) + deltaY;

  target.style.left = `${newLeft}px`;
  target.style.top = `${newTop}px`;

  // Update token position in currentScene
  const token = currentScene.tokens.find(t => t.tokenId === tokenId);
  if (token) {
    token.x = newLeft;
    token.y = newTop;

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
    const img = document.getElementById(`token-${tokenId}`);
    if (img) {
      img.style.left = `${token.x}px`;
      img.style.top = `${token.y}px`;
      img.style.width = `${token.width}px`;
      img.style.height = `${token.height}px`;
      img.style.transform = `rotate(${token.rotation}deg)`;

      // Setup draggable interaction
      setupDraggable(img, token.movableByPlayers);
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
    const img = document.getElementById(`token-${tokenId}`);
    if (img && img.parentNode === sceneContainer) {
      sceneContainer.removeChild(img);
    }
  }
});















// === Utility Functions ===



// Function to extract the dominant color from an image
function extractDominantColor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // This may be needed if images are served from a different origin
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
  const img = document.getElementById(`token-${tokenId}`);
  if (img) {
    img.addEventListener('mouseenter', () => {
      img.style.boxShadow = enable ? '0 0 16px 5px rgb(0,0,0,0.25)' : 'none';
    });

    img.addEventListener('mouseleave', () => {
      img.style.boxShadow = 'none';
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
  audioElement.src = data.musicUrl;
  audioElement.currentTime = data.currentTime;

  if (audioEnabled) {
    audioElement.play().catch((error) => {
      console.error('Error playing audio:', error);
      // Since audio is enabled, do not re-display the "Enable Audio" button
      // Optionally, you can handle the error as needed
    });
  } else {
    // Show the enable audio button if audio is not enabled
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

enableAudioButton.addEventListener('click', () => {
  audioEnabled = true;
  enableAudioButton.style.display = 'none';

  // Attempt to play music if music data is available
  if (currentMusicData) {
    audioElement.src = currentMusicData.musicUrl;
    audioElement.currentTime = currentMusicData.currentTime;
    audioElement.play().catch((error) => {
      console.error('Error playing audio after enabling:', error);
      // Optionally, handle the error as needed
    });
  }
});

document.getElementById('enable-audio-button').addEventListener('click', function() {
  document.getElementById('audio-overlay').style.display = 'none';
});