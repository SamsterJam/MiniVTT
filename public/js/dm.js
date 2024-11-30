document.addEventListener('DOMContentLoaded', function () {
  const socket = io();

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  let currentScene = null;

  const sceneContainer = document.getElementById('scene-container');

  // Handle dragover event to allow drop
  sceneContainer.addEventListener('dragover', function (event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    // Add visual feedback
    sceneContainer.classList.add('dragover');
  });

  // Handle dragleave event to remove visual feedback
  sceneContainer.addEventListener('dragleave', function (event) {
    sceneContainer.classList.remove('dragover');
  });

  // Handle drop event
  sceneContainer.addEventListener('drop', function (event) {
    event.preventDefault();
    sceneContainer.classList.remove('dragover');

    if (!currentScene) {
      alert('Please load or create a scene first.');
      return;
    }

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];

      const formData = new FormData();
      formData.append('image', file);

      fetch('/upload', {
        method: 'POST',
        body: formData
      })
        .then(response => response.json())
        .then(data => {
          const imageUrl = data.imageUrl;
          // Get the drop position relative to the scene container
          const rect = sceneContainer.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;

          // Create a new token
          const token = {
            tokenId: Date.now().toString(),
            imageUrl: imageUrl,
            x: x,
            y: y,
            width: 100,
            height: 100,
            rotation: 0,
            movableByPlayers: false,
            name: 'New Token'
          };

          // Add token to the scene
          currentScene.tokens.push(token);
          // Save the scene on the server
          socket.emit('addToken', { sceneId: currentScene.sceneId, token: token });
          // Render the token
          renderToken(token);
        })
        .catch(error => {
          console.error('Error uploading token image:', error);
        });
    }
  });

  // Handle scene creation
  document.getElementById('create-scene-button').addEventListener('click', function () {
    const sceneNameInput = document.getElementById('scene-name-input');
    const sceneName = sceneNameInput.value.trim();
    if (sceneName) {
      fetch('/createScene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneName })
      })
        .then(response => response.json())
        .then(data => {
          const sceneId = data.sceneId;
          // Load the new scene
          loadScene(sceneId);
          // Update scene selection dropdown
          fetchSceneList();
        })
        .catch(error => {
          console.error('Error creating scene:', error);
        });
    } else {
      alert('Please enter a scene name.');
    }
  });

  // Fetch the list of scenes and populate the dropdown
  function fetchSceneList() {
    fetch('/scenes')
      .then(response => response.json())
      .then(data => {
        const sceneSelect = document.getElementById('scene-select');
        sceneSelect.innerHTML = ''; // Clear existing options
        data.scenes.forEach(scene => {
          const option = document.createElement('option');
          option.value = scene.sceneId;
          option.textContent = scene.sceneName; // Use the scene name here
          sceneSelect.appendChild(option);
        });
      })
      .catch(error => {
        console.error('Error fetching scene list:', error);
      });
  }

  // Handle scene switching
  document.getElementById('switch-scene-button').addEventListener('click', function () {
    const sceneSelect = document.getElementById('scene-select');
    const selectedSceneId = sceneSelect.value;
    if (selectedSceneId) {
      // Notify the server to change the active scene
      socket.emit('changeScene', { sceneId: selectedSceneId });
      // Load the selected scene
      loadScene(selectedSceneId);
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
  function renderToken(token) {
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

    // Make the token draggable and resizable
    interact(img)
      .draggable({
        onmove: onTokenDragMove,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: sceneContainer,
            endOnly: true
          })
        ]
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        invert: 'none'
      })
      .on('resizemove', onTokenResizeMove);
  }

  // Event handler for token drag
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

  // Event handler for token resize
  function onTokenResizeMove(event) {
    const target = event.target;
    const tokenId = target.dataset.tokenId;

    let newWidth = event.rect.width;
    let newHeight = event.rect.height;

    // Update the element's style
    target.style.width = `${newWidth}px`;
    target.style.height = `${newHeight}px`;

    // Optionally adjust position if needed
    const deltaX = event.deltaRect.left;
    const deltaY = event.deltaRect.top;

    const newLeft = (parseFloat(target.style.left) || 0) + deltaX;
    const newTop = (parseFloat(target.style.top) || 0) + deltaY;

    target.style.left = `${newLeft}px`;
    target.style.top = `${newTop}px`;

    // Update token size and position in currentScene
    const token = currentScene.tokens.find(t => t.tokenId === tokenId);
    if (token) {
      token.x = newLeft;
      token.y = newTop;
      token.width = newWidth;
      token.height = newHeight;

      // Send update to server
      socket.emit('updateToken', {
        sceneId: currentScene.sceneId,
        tokenId: tokenId,
        properties: {
          x: token.x,
          y: token.y,
          width: token.width,
          height: token.height
        }
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
      }
    }
  });

  // Initial fetching of scene list
  fetchSceneList();
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