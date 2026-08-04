// session.js
// One shared session instance: Express authenticates the DM against it, and
// Socket.IO reads the same session so a client cannot simply claim to be the DM.
const session = require('express-session');
const config = require('./config');

module.exports = session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
});
