// socketHandler.js
const Scene = require('./models/sceneModel');
const session = require('./session');

// Playback state still lives in the DM's browser; the server only relays.
const MUSIC_EVENTS = ['addTrack', 'playTrack', 'pauseTrack', 'setTrackVolume', 'deleteTrack'];

module.exports = (io) => {
  io.engine.use(session);

  // The page asks for a role, the session decides whether it gets it. Asking
  // alone proves nothing, but it lets a DM open the player view in the same
  // browser and be treated as a genuine player there.
  io.use((socket, next) => {
    const wantsDM = socket.handshake.query.role === 'dm';
    socket.isDM = wantsDM && Boolean(socket.request.session?.isDM);
    next();
  });

  io.on('connection', (socket) => {
    const role = socket.isDM ? 'dm' : 'player';
    socket.join(role);
    console.log(`${role} connected (${socket.id})`);
    socket.on('disconnect', () => console.log(`${role} disconnected (${socket.id})`));

    socket.emit('activeSceneId', Scene.activeSceneId);

    socket.on('loadScene', ({ sceneId } = {}) => {
      const scene = Scene.sceneFor(sceneId, socket.isDM);
      if (scene) socket.emit('sceneData', scene);
      else socket.emit('error', { message: 'Scene not found.' });
    });

    // Open to players too; the model decides what they may actually touch.
    socket.on('updateToken', ({ sceneId, tokenId, properties } = {}) => {
      Scene.updateToken(sceneId, tokenId, properties, socket);
    });

    if (!socket.isDM) return;

    // --- DM only ---
    socket.on('changeScene', ({ sceneId } = {}) => {
      Scene.setActiveScene(sceneId);
      io.emit('activeSceneId', Scene.activeSceneId);
    });

    socket.on('addToken', ({ sceneId, token } = {}) => Scene.addToken(sceneId, token, socket));

    socket.on('removeToken', ({ sceneId, tokenId } = {}) =>
      Scene.removeToken(sceneId, tokenId, socket)
    );

    for (const event of MUSIC_EVENTS) {
      socket.on(event, (data) => socket.broadcast.emit(event, data));
    }
  });
};
