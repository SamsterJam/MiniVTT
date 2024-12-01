const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const fsPromises = fs.promises; // Use promises for async/await

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



// Define storage for music files using Multer
const musicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadMusicPath = 'public/music/';
    // Create the directory if it doesn't exist
    fs.mkdirSync(uploadMusicPath, { recursive: true });
    cb(null, uploadMusicPath);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Initialize Multer for music uploads
const uploadMusic = multer({ storage: musicStorage });


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
  socket.on('removeToken', async ({ sceneId, tokenId }) => {
    const scene = scenes[sceneId];
    if (scene) {
      // Find the token before removing it
      const tokenIndex = scene.tokens.findIndex(t => t.tokenId === tokenId);
      if (tokenIndex !== -1) {
        const token = scene.tokens[tokenIndex];
        const imageUrl = token.imageUrl;

        // Remove the token
        scene.tokens.splice(tokenIndex, 1);

        // Mark the scene as dirty
        scene.dirty = true;

        // Check if the image is used elsewhere
        const imageUsedElsewhere = await isImageUsedElsewhere(imageUrl);

        // If not used elsewhere, delete the image file
        if (!imageUsedElsewhere) {
          const imagePath = path.join(__dirname, 'public', imageUrl);
          try {
            await fsPromises.unlink(imagePath);
            console.log('Deleted unused image file:', imagePath);
          } catch (err) {
            console.error('Error deleting image file:', err);
          }
        }

        // Broadcast the token removal to all clients
        io.emit('removeToken', { sceneId, tokenId });
      }
    }
  });

  // Handle music control events from DM
  socket.on('playMusic', (data) => {
    // Broadcast to all other clients except the sender
    socket.broadcast.emit('playMusic', data);
  });

  socket.on('pauseMusic', (data) => {
    socket.broadcast.emit('pauseMusic', data);
  });

  socket.on('stopMusic', () => {
    socket.broadcast.emit('stopMusic');
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

// Route to delete a scene
app.post('/deleteScene', express.json(), async (req, res) => {
  const { sceneId } = req.body;
  if (scenes[sceneId]) {
    const scene = scenes[sceneId];
    // Get list of imageUrls in this scene
    const imageUrls = scene.tokens.map(token => token.imageUrl);

    try {
      // Delete the scene file from the filesystem
      const filePath = path.join(__dirname, 'data', 'scenes', `${sceneId}.json`);
      await fsPromises.unlink(filePath);

      // Remove the scene from the in-memory object
      delete scenes[sceneId];

      // For each imageUrl, check if it's used elsewhere
      for (const imageUrl of imageUrls) {
        const imageUsedElsewhere = await isImageUsedElsewhere(imageUrl);

        if (!imageUsedElsewhere) {
          const imagePath = path.join(__dirname, 'public', imageUrl);
          try {
            await fsPromises.unlink(imagePath);
            console.log('Deleted unused image file:', imagePath);
          } catch (err) {
            console.error('Error deleting image file:', err);
          }
        }
      }

      res.json({ success: true });
      // Emit an event to update other connected clients
      io.emit('sceneDeleted', { sceneId });

    } catch (err) {
      console.error('Error deleting scene file:', err);
      res.json({ success: false, message: 'Error deleting scene file.' });
    }

  } else {
    res.json({ success: false, message: 'Scene not found.' });
  }
});

// Helper function to check if an image is used elsewhere
async function isImageUsedElsewhere(imageUrl) {
  const sceneFiles = await fsPromises.readdir(path.join(__dirname, 'data', 'scenes'));
  for (const file of sceneFiles) {
    if (file.endsWith('.json')) {
      const sceneId = path.basename(file, '.json');
      let scene;
      try {
        // If the scene is in memory, use that
        if (scenes[sceneId]) {
          scene = scenes[sceneId];
        } else {
          // Otherwise, read from file
          const data = await fsPromises.readFile(path.join(__dirname, 'data', 'scenes', file), 'utf8');
          scene = JSON.parse(data);
        }

        const tokens = scene.tokens || [];
        for (const token of tokens) {
          if (token.imageUrl === imageUrl) {
            return true;  // Image is still used in this scene
          }
        }
      } catch (err) {
        console.error('Error reading or parsing scene file:', file, err);
        // Continue to next file
      }
    }
  }
  return false;  // Image is not used in any other token in any scene
}

// Route to handle music uploads
app.post('/uploadMusic', uploadMusic.single('music'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No music file uploaded.' });
  }

  // File information is available in req.file
  console.log(`Music uploaded: ${req.file.filename}`);

  // Return the music URL and filename to the client
  res.json({
    success: true,
    musicUrl: `/music/${req.file.filename}`,
    filename: req.file.filename
  });
});


// Route to get list of uploaded music tracks
app.get('/musicList', (req, res) => {
  const musicDir = path.join(__dirname, 'public', 'music');
  fs.readdir(musicDir, (err, files) => {
    if (err) {
      console.error('Error reading music directory:', err);
      return res.status(500).json({ success: false, message: 'Error reading music directory.' });
    }
    // Optionally filter for audio files only
    const musicFiles = files.filter(file => {
      return (
        file.endsWith('.mp3') ||
        file.endsWith('.wav') ||
        file.endsWith('.ogg') ||
        file.endsWith('.m4a') ||
        file.endsWith('.flac')
      );
    });
    // Map the files to an array of { name: filename, filename: filename, url: '/music/filename' }
    const musicTracks = musicFiles.map(file => {
      return {
        name: file.replace(/^\d+\s*[-_]?\s*/, ''), // Process name if needed
        filename: file,
        url: '/music/' + file
      };
    });
    res.json({ success: true, musicTracks });
  });
});

// Route to delete music track
app.post('/deleteMusic', express.json(), (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ success: false, message: 'No filename provided.' });
  }

  const musicDir = path.join(__dirname, 'public', 'music');
  // Ensure the filename is safe (prevents directory traversal attacks)
  const safeFilename = path.basename(filename);
  const filePath = path.join(musicDir, safeFilename);

  // Check if the file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('Music file does not exist:', filePath);
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    // Delete the file
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting music file:', err);
        return res.status(500).json({ success: false, message: 'Error deleting file.' });
      }
      console.log('Deleted music file:', filePath);
      res.json({ success: true });
    });
  });
});