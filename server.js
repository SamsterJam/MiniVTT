// server.js
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const config = require('./config');
const Scene = require('./models/sceneModel');
const Music = require('./models/musicModel');
const Settings = require('./models/settingsModel');

const server = http.createServer(app);
const io = new Server(server);

require('./socketHandler')(io);

const bold = '\x1b[1m';
const green = '\x1b[32m';
const reset = '\x1b[0m';

async function start() {
  // Read every scene up front; the model relies on holding all of them.
  await Scene.load();
  await Music.load();
  await Settings.load();

  server.listen(config.port, () => {
    console.log(`MiniVTT is running on port ${config.port}`);
    if (config.dmPasswordIsGenerated) {
      console.log(`${bold}DM Password: ${green}${config.dmPassword}${reset}`);
      console.log('Set DM_PASSWORD and SESSION_SECRET to keep these stable across restarts.');
    }
  });
}

// Flush anything the autosave has not written yet before exiting.
async function shutdown() {
  console.log('\nSaving scenes...');
  await Scene.flush();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
