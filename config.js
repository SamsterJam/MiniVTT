// config.js
const crypto = require('crypto');

// No 0/O or 1/l/I, so the password survives being read off a terminal.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';

const generatePassword = (length = 10) =>
  Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

// Both secrets fall back to a fresh random value, so a restart rotates the
// password and logs the DM out. Set them in the environment to survive one.
const dmPassword = process.env.DM_PASSWORD || generatePassword();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  dmPassword,
  dmPasswordIsGenerated: !process.env.DM_PASSWORD,
};
