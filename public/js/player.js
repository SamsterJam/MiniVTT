// public/js/player.js

const socket = io();

socket.on('connect', () => {
  console.log('Connected to server');
});


let currentScene = null;


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
  const sceneContainer = document.getElementById('scene-container');
  sceneContainer.innerHTML = ''; // Clear existing content

  // Render tokens
  scene.tokens.forEach(token => {
    renderToken(token);
  });
}

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
    interact(img)
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

  const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
  const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

  target.style.transform = `translate(${x}px, ${y}px)`;

  target.setAttribute('data-x', x);
  target.setAttribute('data-y', y);

  // Update token position in currentScene
  const token = currentScene.tokens.find(t => t.tokenId === tokenId);
  if (token) {
    token.x += event.dx;
    token.y += event.dy;

    // Send update to server
    socket.emit('updateToken', { sceneId: currentScene.sceneId, tokenId: tokenId, properties: { x: token.x, y: token.y } });
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
    }
  }
});

socket.on('addToken', ({ sceneId, token }) => {
  if (currentScene.sceneId !== sceneId) return;

  // Add the new token to the scene's token list
  currentScene.tokens.push(token);

  // Render the new token
  renderToken(token);
});