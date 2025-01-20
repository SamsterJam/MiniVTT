const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server);

// Generate a random password
function generatePassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

// Use ANSI escape codes for bold and green text
const bold = '\x1b[1m';
const green = '\x1b[32m';
const reset = '\x1b[0m';

app.locals.dmPassword = generatePassword();
console.log(`${bold}DM Password: ${green}${app.locals.dmPassword}${reset}`);

// Initialize socket handlers
require('./socketHandler')(io);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
