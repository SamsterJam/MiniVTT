// app.js
const express = require('express');
const path = require('path');
const session = require('./session');
const routes = require('./routes');

const app = express();

app.use(session);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Served from node_modules rather than a CDN, so this works with no internet.
app.use('/vendor/interact', express.static(path.join(__dirname, 'node_modules/interactjs/dist')));
app.use('/vendor/sortable', express.static(path.join(__dirname, 'node_modules/sortablejs')));

app.use('/', routes);

module.exports = app;
