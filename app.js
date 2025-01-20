// app.js
const express = require('express');
const path = require('path');
const app = express();

// Required modules
const session = require('express-session');
const crypto = require('crypto');

// Generate a secure random secret
function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

// Use an environment variable or generate a new secret
const sessionSecret = process.env.SESSION_SECRET || generateSecret();

// Session setup
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const routes = require('./routes');
app.use('/', routes);

module.exports = app;