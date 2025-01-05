// socketHandler.js
const Scene = require('./models/sceneModel');

module.exports = (io) => {
  // Scene management
  io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the active scene ID to the client upon connection
    socket.emit('activeSceneId', Scene.activeSceneId);

    // Handle socket events here
    socket.on('loadScene', async ({ sceneId }) => {
      try {
        const scene = await Scene.loadScene(sceneId);
        socket.emit('sceneData', scene);
      } catch (err) {
        console.error(err);
        socket.emit('error', { message: 'Failed to load scene.' });
      }
    });

    socket.on('changeScene', ({ sceneId }) => {
      Scene.changeActiveScene(sceneId);
      io.emit('activeSceneId', Scene.activeSceneId);
    });

    socket.on('updateToken', ({ sceneId, tokenId, properties }) => {
      Scene.updateToken(sceneId, tokenId, properties, socket);
    });

    socket.on('addToken', ({ sceneId, token }) => {
      Scene.addToken(sceneId, token, io);
    });

    socket.on('removeToken', async ({ sceneId, tokenId }) => {
      await Scene.removeToken(sceneId, tokenId, io);
    });

    // Music control events
    socket.on('playMusic', (data) => {
      socket.broadcast.emit('playMusic', data);
    });

    socket.on('pauseMusic', (data) => {
      socket.broadcast.emit('pauseMusic', data);
    });

    socket.on('stopMusic', () => {
      socket.broadcast.emit('stopMusic');
    });

    socket.on('setVolume', (data) => {
      socket.broadcast.emit('setVolume', data);
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
  });
};