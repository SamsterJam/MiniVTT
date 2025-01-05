// app.js
const express = require('express');
const path = require('path');
const app = express();

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const routes = require('./routes');
app.use('/', routes);

module.exports = app;