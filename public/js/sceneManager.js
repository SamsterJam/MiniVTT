export class SceneManager {
  constructor(socket, sceneContainer) {
    this.socket = socket;
    this.sceneContainer = sceneContainer;
    this.currentScene = null;
    this.selectedTokenId = null;

    this.init();
  }

  init() {
    this.setupSocketListeners();
    this.setupSceneContainerListeners();
    this.fetchSceneList();
    this.setupKeyListeners();
  }

  setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('sceneData', (scene) => this.onSceneData(scene));

    this.socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
      this.onUpdateToken(sceneId, tokenId, properties);
    });

    this.socket.on('removeToken', ({ sceneId, tokenId }) => {
      this.onRemoveToken(sceneId, tokenId);
    });

    this.socket.on('sceneDeleted', ({ sceneId }) => {
      this.onSceneDeleted(sceneId);
    });

    // Add other socket event handlers as needed
  }

  setupSceneContainerListeners() {
    this.sceneContainer.addEventListener('dragover', (event) => this.onDragOver(event));
    this.sceneContainer.addEventListener('dragleave', (event) => this.onDragLeave(event));
    this.sceneContainer.addEventListener('drop', (event) => this.onDrop(event));

    // Unselect token when clicking on the scene background
    this.sceneContainer.addEventListener('click', (event) => this.onSceneClick(event));
  }

  setupKeyListeners() {
    // Handle Delete key press to remove selected token and other key events
    document.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  fetchSceneList() {
    fetch('/scenes')
      .then((response) => response.json())
      .then((data) => {
        this.renderSceneButtons(data.scenes);
      })
      .catch((error) => {
        console.error('Error fetching scene list:', error);
      });
  }

  renderSceneButtons(scenes) {
    const sceneButtonsContainer = document.getElementById('scene-buttons-container');
    sceneButtonsContainer.innerHTML = ''; // Clear existing buttons
    scenes.forEach((scene) => {
      const button = document.createElement('button');
      button.className = 'scene-button';
      button.textContent = scene.sceneName;
      button.dataset.sceneId = scene.sceneId;
      button.addEventListener('click', () => this.onSceneButtonClick(scene));

      sceneButtonsContainer.appendChild(button);
    });

    // Update active scene button
    if (this.currentScene) {
      const activeButton = document.querySelector(`.scene-button[data-scene-id="${this.currentScene.sceneId}"]`);
      if (activeButton) {
        activeButton.classList.add('active');
      }
    }
  }

  onSceneButtonClick(scene) {
    // Notify the server to change the active scene
    this.socket.emit('changeScene', { sceneId: scene.sceneId });
    // Load the selected scene
    this.loadScene(scene.sceneId);

    // Update the active class on buttons
    const buttons = document.querySelectorAll('.scene-button');
    buttons.forEach((btn) => btn.classList.remove('active'));
    const button = document.querySelector(`.scene-button[data-scene-id="${scene.sceneId}"]`);
    if (button) {
      button.classList.add('active');
    }
  }

  loadScene(sceneId) {
    this.socket.emit('loadScene', { sceneId: sceneId });
  }

  onSceneData(scene) {
    this.currentScene = scene;
    this.renderScene(scene);

    // Update active scene button
    const buttons = document.querySelectorAll('.scene-button');
    buttons.forEach((btn) => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.scene-button[data-scene-id="${scene.sceneId}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
  }

  renderScene(scene) {
    this.sceneContainer.innerHTML = ''; // Clear existing content

    // Render tokens
    scene.tokens.forEach((token) => {
      this.renderToken(token);
    });

    // After rendering tokens, find the largest token by area
    if (scene.tokens.length > 0) {
      let largestToken = scene.tokens.reduce((prev, current) => {
        return prev.width * prev.height > current.width * current.height ? prev : current;
      });

      // Extract the dominant color from the largest token's image
      this.extractDominantColor(largestToken.imageUrl)
        .then((color) => {
          // Set the background color of the scene container
          this.sceneContainer.style.backgroundColor = color;
        })
        .catch((err) => {
          console.error('Error extracting dominant color:', err);
        });
    } else {
      // If there are no tokens, reset the background color
      this.sceneContainer.style.backgroundColor = '';
    }
  }

  renderToken(token) {
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

    this.sceneContainer.appendChild(img);

    // Add click event listener for token selection
    img.addEventListener('click', (event) => this.onTokenClick(event, token.tokenId));

    // Make the token draggable and resizable
    interact(img)
      .draggable({
        onmove: (event) => this.onTokenDragMove(event),
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: this.sceneContainer,
            endOnly: true,
          }),
        ],
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        invert: 'none',
      })
      .on('resizemove', (event) => this.onTokenResizeMove(event));

    // Add blue border if the token is movable by players
    if (token.movableByPlayers) {
      img.style.border = '2px dashed blue';
    }
  }

  onTokenClick(event, tokenId) {
    event.stopPropagation(); // Prevent click from bubbling up to sceneContainer
    // Unselect any previously selected token
    if (this.selectedTokenId && this.selectedTokenId !== tokenId) {
      const prevSelectedImg = document.getElementById(`token-${this.selectedTokenId}`);
      if (prevSelectedImg) {
        prevSelectedImg.style.boxShadow = ''; // Remove shadow
      }
    }
    // Set this token as selected
    this.selectedTokenId = tokenId;
    const img = event.currentTarget;
    // Add shadow to selected token
    img.style.boxShadow = '0px 0px 10px 3px #222222';
  }

  onSceneClick(event) {
    // If clicked directly on the sceneContainer (not on any token)
    if (event.target === this.sceneContainer) {
      if (this.selectedTokenId) {
        const prevSelectedImg = document.getElementById(`token-${this.selectedTokenId}`);
        if (prevSelectedImg) {
          prevSelectedImg.style.boxShadow = ''; // Remove shadow
        }
        this.selectedTokenId = null;
      }
    }
  }

  onKeyDown(event) {
    if (this.selectedTokenId && event.key === 'Delete') {
      this.deleteSelectedToken();
    } else if (this.selectedTokenId && event.key === 'i') {
      // Toggle 'movableByPlayers' property
      this.toggleTokenMovableByPlayers(this.selectedTokenId);
    } else if (event.key.toLowerCase() === 't') {
      // Toggle toolbar visibility
      this.toggleToolbar();
    } else if (event.key.toLowerCase() === 'm') {
      const musicPanel = document.getElementById('music-panel');
      musicPanel.classList.toggle('hidden');
    } else if (event.shiftKey && event.key.toLowerCase() === 'd') {
      // Shift + D pressed: Prompt to delete the current scene
      if (this.currentScene) {
        const confirmDelete = confirm('Are you sure you want to delete the current scene? This action cannot be undone.');
        if (confirmDelete) {
          // Proceed to delete the scene
          this.deleteCurrentScene();
        }
      } else {
        alert('No scene is currently loaded.');
      }
    }
  }

  toggleToolbar() {
    const toolbar = document.getElementById('toolbar');
    if (toolbar.style.top === '0px' || toolbar.style.top === '') {
      toolbar.style.top = '-50px'; // Adjust this value based on the toolbar height
    } else {
      toolbar.style.top = '0px';
    }
  }

  deleteSelectedToken() {
    // Remove the selected token
    const tokenIndex = this.currentScene.tokens.findIndex((t) => t.tokenId === this.selectedTokenId);
    if (tokenIndex !== -1) {
      const token = this.currentScene.tokens[tokenIndex];
      // Remove from currentScene.tokens
      this.currentScene.tokens.splice(tokenIndex, 1);
      // Remove from DOM
      const img = document.getElementById(`token-${this.selectedTokenId}`);
      if (img) {
        this.sceneContainer.removeChild(img);
      }
      // Notify server
      this.socket.emit('removeToken', {
        sceneId: this.currentScene.sceneId,
        tokenId: this.selectedTokenId,
      });
      // Clear selectedTokenId
      this.selectedTokenId = null;
    }
  }

  onTokenDragMove(event) {
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
    const token = this.currentScene.tokens.find((t) => t.tokenId === tokenId);
    if (token) {
      token.x = newLeft;
      token.y = newTop;

      // Send update to server
      this.socket.emit('updateToken', {
        sceneId: this.currentScene.sceneId,
        tokenId: tokenId,
        properties: { x: token.x, y: token.y },
      });
    }
  }

  onTokenResizeMove(event) {
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
    const token = this.currentScene.tokens.find((t) => t.tokenId === tokenId);
    if (token) {
      token.x = newLeft;
      token.y = newTop;
      token.width = newWidth;
      token.height = newHeight;

      // Send update to server
      this.socket.emit('updateToken', {
        sceneId: this.currentScene.sceneId,
        tokenId: tokenId,
        properties: {
          x: token.x,
          y: token.y,
          width: token.width,
          height: token.height,
        },
      });
    }
  }

  toggleTokenMovableByPlayers(tokenId) {
    const token = this.currentScene.tokens.find((t) => t.tokenId === tokenId);
    if (token) {
      token.movableByPlayers = !token.movableByPlayers;

      // Update the token's visual representation
      const img = document.getElementById(`token-${tokenId}`);
      if (img) {
        if (token.movableByPlayers) {
          img.style.border = '2px dashed blue';
        } else {
          img.style.border = '';
        }
      }

      // Send update to server
      this.socket.emit('updateToken', {
        sceneId: this.currentScene.sceneId,
        tokenId: tokenId,
        properties: { movableByPlayers: token.movableByPlayers },
      });
    }
  }

  deleteCurrentScene() {
    fetch('/deleteScene', {
      method: 'POST', // Use 'DELETE' if your server supports it
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId: this.currentScene.sceneId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert('Scene deleted successfully.');
          // Clear the current scene and tokens
          this.currentScene = null;
          this.sceneContainer.innerHTML = '';
          // Update the scene list
          this.fetchSceneList();
        } else {
          alert('Failed to delete the scene.');
        }
      })
      .catch((error) => {
        console.error('Error deleting scene:', error);
        alert('An error occurred while deleting the scene.');
      });
  }

  onUpdateToken(sceneId, tokenId, properties) {
    if (!this.currentScene || this.currentScene.sceneId !== sceneId) return;

    const token = this.currentScene.tokens.find((t) => t.tokenId === tokenId);
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

        // Update border based on 'movableByPlayers'
        if (token.movableByPlayers) {
          img.style.border = '2px dashed blue';
        } else {
          img.style.border = '';
        }
      }
    }
  }

  onRemoveToken(sceneId, tokenId) {
    if (!this.currentScene || this.currentScene.sceneId !== sceneId) return;

    const tokenIndex = this.currentScene.tokens.findIndex((t) => t.tokenId === tokenId);
    if (tokenIndex !== -1) {
      // Remove from currentScene.tokens
      this.currentScene.tokens.splice(tokenIndex, 1);
      // Remove from DOM
      const img = document.getElementById(`token-${tokenId}`);
      if (img && img.parentNode === this.sceneContainer) {
        this.sceneContainer.removeChild(img);
      }
      // If the removed token was selected, unselect it
      if (this.selectedTokenId === tokenId) {
        this.selectedTokenId = null;
      }
    }
  }

  onSceneDeleted(sceneId) {
    // If the current scene has been deleted, clear it from the UI
    if (this.currentScene && this.currentScene.sceneId === sceneId) {
      this.currentScene = null;
      this.sceneContainer.innerHTML = '';
    }
    // Update the scene list
    this.fetchSceneList();
  }

  onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    // Add visual feedback
    this.sceneContainer.classList.add('dragover');
  }

  onDragLeave(event) {
    this.sceneContainer.classList.remove('dragover');
  }

  onDrop(event) {
    event.preventDefault();
    this.sceneContainer.classList.remove('dragover');

    if (!this.currentScene) {
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
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          const imageUrl = data.imageUrl;
          // Get the drop position relative to the scene container
          const rect = this.sceneContainer.getBoundingClientRect();
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
            movableByPlayers: false, // Add this line
            name: 'New Token',
          };

          // Add token to the scene
          this.currentScene.tokens.push(token);
          // Save the scene on the server
          this.socket.emit('addToken', { sceneId: this.currentScene.sceneId, token: token });
          // Render the token
          this.renderToken(token);
        })
        .catch((error) => {
          console.error('Error uploading token image:', error);
        });
    }
  }

  extractDominantColor(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous'; // This may be needed if images are served from a different origin
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
        reject('Image loading error');
      };
    });
  }

  createScene(sceneName) {
    fetch('/createScene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneName }),
    })
      .then((response) => response.json())
      .then((data) => {
        const sceneId = data.sceneId;
        // Load the new scene
        this.loadScene(sceneId);
        // Update scene buttons
        this.fetchSceneList();
      })
      .catch((error) => {
        console.error('Error creating scene:', error);
      });
  }
}