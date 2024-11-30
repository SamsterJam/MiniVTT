const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Define storage for Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'public/uploads/';
    // Create the directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Use the original file name or generate a unique one
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Initialize Multer
const upload = multer({ storage: storage });

// Set up static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Scene management
let activeSceneId = null;
let scenes = {};  // Key: sceneId, Value: scene object

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected');

  // Send the active scene ID to the client upon connection
  socket.emit('activeSceneId', activeSceneId);

  // Client requests to load a scene
  socket.on('loadScene', async ({ sceneId }) => {
    try {
      let scene = scenes[sceneId];
      if (!scene) {
        // If scene not in memory, load from file
        scene = await loadScene(sceneId);
        scenes[sceneId] = scene;
      }
      // Send scene data to the client
      socket.emit('sceneData', scene);
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to load scene.' });
    }
  });

  // DM changes the active scene
  socket.on('changeScene', ({ sceneId }) => {
    activeSceneId = sceneId;
    // Inform all clients of the new active scene
    io.emit('activeSceneId', activeSceneId);
  });

  // Client updates a token (move, resize, rotate)
  socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
    const scene = scenes[sceneId];
    if (scene) {
      const token = scene.tokens.find(t => t.tokenId === tokenId);
      if (token) {
        // Update token properties
        Object.assign(token, properties);

        // Mark the scene as dirty
        scene.dirty = true;

        // Broadcast the update to other clients
        socket.broadcast.emit('updateToken', { sceneId, tokenId, properties });
      }
    }
  });

  // DM adds a new token
  socket.on('addToken', ({ sceneId, token }) => {
    const scene = scenes[sceneId];
    if (scene) {
      scene.tokens.push(token);

      // Mark the scene as dirty
      scene.dirty = true;

      // Broadcast the new token to all clients
      io.emit('addToken', { sceneId, token });
    }
  });

  // DM removes a token
  socket.on('removeToken', ({ sceneId, tokenId }) => {
    const scene = scenes[sceneId];
    if (scene) {
      scene.tokens = scene.tokens.filter(t => t.tokenId !== tokenId);

      // Mark the scene as dirty
      scene.dirty = true;

      // Broadcast the token removal to all clients
      io.emit('removeToken', { sceneId, tokenId });
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Periodically save dirty scenes
const SAVE_INTERVAL = 1000; // milliseconds

setInterval(() => {
  Object.values(scenes).forEach(scene => {
    if (scene.dirty) {
      saveScene(scene);
      scene.dirty = false; // Reset the dirty flag
    }
  });
}, SAVE_INTERVAL);

// Route for DM interface
app.get('/dm', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dm.html'));
});

// Route to handle image uploads
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  // File information is available in req.file
  console.log(`File uploaded: ${req.file.filename}`);

  // Return the file path to the client
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// Function to save a scene object to a file
function saveScene(scene) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, 'data', 'scenes', `${scene.sceneId}.json`);
    fs.writeFile(filePath, JSON.stringify(scene, null, 2), (err) => {
      if (err) {
        console.error('Error saving scene:', err);
        reject(err);
      } else {
        console.log(`Scene ${scene.sceneId} saved.`);
        resolve();
      }
    });
  });
}

// Function to load a scene object from a file
function loadScene(sceneId) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, 'data', 'scenes', `${sceneId}.json`);
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error loading scene:', err);
        reject(err);
      } else {
        const scene = JSON.parse(data);
        console.log(`Scene ${sceneId} loaded.`);
        resolve(scene);
      }
    });
  });
}

// Route to create a new scene (DM only)
app.post('/createScene', express.json(), async (req, res) => {
  const { sceneName } = req.body;
  const sceneId = Date.now().toString();  // Simple unique ID based on timestamp

  const newScene = {
    sceneId,
    sceneName,
    tokens: []
  };

  // Save the new scene immediately
  await saveScene(newScene);
  scenes[sceneId] = newScene;

  res.json({ sceneId });
});

// Route to get the list of scenes (DM only)
app.get('/scenes', (req, res) => {
  // Read the files in the data/scenes directory
  fs.readdir(path.join(__dirname, 'data', 'scenes'), (err, files) => {
    if (err) {
      console.error('Error reading scenes directory:', err);
      return res.status(500).send('Error reading scenes directory.');
    }

    // Filter out non-.json files
    const sceneFiles = files.filter(file => file.endsWith('.json'));

    // If there are no scenes, return an empty array
    if (sceneFiles.length === 0) {
      return res.json({ scenes: [] });
    }

    const scenes = []; // Array to hold scene info
    let filesProcessed = 0;

    sceneFiles.forEach(file => {
      const filePath = path.join(__dirname, 'data', 'scenes', file);

      fs.readFile(filePath, 'utf8', (err, data) => {
        filesProcessed++;
        if (err) {
          console.error('Error reading scene file:', err);
          // Optionally, handle error or skip this file
        } else {
          try {
            const scene = JSON.parse(data);
            scenes.push({ sceneId: scene.sceneId, sceneName: scene.sceneName });
          } catch (parseErr) {
            console.error('Error parsing scene file:', parseErr);
          }
        }

        // Once all files have been processed, send the response
        if (filesProcessed === sceneFiles.length) {
          res.json({ scenes });
        }
      });
    });
  });
});

// Route to update scene properties
app.post('/updateScene', express.json(), async (req, res) => {
  const { scene } = req.body;
  const sceneId = scene.sceneId;

  if (!scenes[sceneId]) {
    scenes[sceneId] = scene;
  } else {
    // Update existing scene properties
    Object.assign(scenes[sceneId], scene);
  }

  // Mark the scene as dirty
  scenes[sceneId].dirty = true;

  // Optionally, save the scene immediately or rely on periodic saving
  // await saveScene(scenes[sceneId]);

  res.json({ message: 'Scene updated.' });
});