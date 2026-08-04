// routes.js
const express = require('express');
const crypto = require('crypto');
const path = require('path');

const config = require('./config');
const sceneController = require('./controllers/sceneController');
const uploadController = require('./controllers/uploadController');
const musicController = require('./controllers/musicController');

const router = express.Router();
const page = (name) => path.join(__dirname, 'public', name);

function requireDM(req, res, next) {
  if (req.session?.isDM) return next();
  res.redirect('/dm-login');
}

/** Compare in constant time so the password cannot be recovered by timing. */
function passwordMatches(input) {
  const given = Buffer.from(String(input ?? ''));
  const expected = Buffer.from(config.dmPassword);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// --- DM authentication ---

router.get('/dm-login', (req, res) => res.sendFile(page('dm-login.html')));

router.post('/dm-login', (req, res) => {
  if (!passwordMatches(req.body.password)) return res.redirect('/dm-login?error=1');

  // A fresh session id on login closes off session fixation.
  req.session.regenerate((err) => {
    if (err) return res.redirect('/dm-login?error=1');
    req.session.isDM = true;
    req.session.save(() => res.redirect('/dm'));
  });
});

router.post('/dm-logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/dm', requireDM, (req, res) => res.sendFile(page('dm.html')));

// --- Scenes ---

router.get('/scenes', sceneController.getScenes); // players need the list too
router.post('/createScene', requireDM, sceneController.createScene);
router.post('/deleteScene', requireDM, sceneController.deleteScene);
router.post('/updateSceneOrder', requireDM, sceneController.updateSceneOrder);

// --- Media ---

router.post('/upload', requireDM, uploadController.uploadFile);
router.post('/uploadMusic', requireDM, musicController.uploadMusic);

module.exports = router;
