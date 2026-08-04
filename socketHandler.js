// socketHandler.js
const Scene = require('./models/sceneModel');
const Music = require('./models/musicModel');
const session = require('./session');

module.exports = (io) => {
  io.engine.use(session);
  Scene.attach(io);
  Music.attach(io);

  // The page asks for a role, the session decides whether it gets it. Asking
  // alone proves nothing, but it lets a DM open the player view as a player.
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

    // Everything the page needs to draw itself, so it never has to ask.
    socket.emit('sceneData', Scene.sceneFor(Scene.activeSceneId, socket.isDM));
    socket.emit('musicState', Music.state());
    if (socket.isDM) socket.emit('sceneList', Scene.listScenes());

    // Open to players too; the model decides what they may actually touch.
    socket.on('updateToken', ({ sceneId, tokenId, properties } = {}) => {
      Scene.updateToken(sceneId, tokenId, properties, socket);
    });

    if (!socket.isDM) return;

    // --- DM only ---
    socket.on('changeScene', ({ sceneId } = {}) => Scene.setActiveScene(sceneId));

    // A new scene is shown to its author alone, leaving the table on the old one.
    socket.on('createScene', ({ sceneName } = {}) => {
      socket.emit('sceneData', Scene.createScene(sceneName));
    });

    socket.on('deleteScene', ({ sceneId } = {}) => Scene.deleteScene(sceneId));
    socket.on('reorderScenes', ({ sceneOrder } = {}) => Scene.reorderScenes(sceneOrder));

    socket.on('addToken', ({ sceneId, token } = {}) => Scene.addToken(sceneId, token, socket));

    socket.on('removeToken', ({ sceneId, tokenId } = {}) =>
      Scene.removeToken(sceneId, tokenId, socket)
    );

    socket.on('playTrack', ({ trackId } = {}) => Music.play(trackId));
    socket.on('pauseTrack', ({ trackId } = {}) => Music.pause(trackId));
    socket.on('setTrackVolume', ({ trackId, volume } = {}) => Music.setVolume(trackId, volume));
    socket.on('deleteTrack', ({ trackId } = {}) => Music.remove(trackId));
  });
};
