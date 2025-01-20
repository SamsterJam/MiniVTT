// routes.js
const express = require('express');
const router = express.Router();
const path = require('path');

// Controllers
const sceneController = require('./controllers/sceneController');
const uploadController = require('./controllers/uploadController');
const musicController = require('./controllers/musicController');

// Middleware to check if user is authenticated as DM
function checkDMAuth(req, res, next) {
  if (req.session && req.session.isDM) {
    next();
  } else {
    res.redirect('/dm-login');
  }
}

// Route for DM login form
router.get('/dm-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dm-login.html'));
});

// Handle DM login
router.post('/dm-login', (req, res) => {
  const password = req.body.password;
  if (password === req.app.locals.dmPassword) {
    req.session.isDM = true;
    res.redirect('/dm');
  } else {
    res.send('Incorrect password. <a href="/dm-login">Try again</a>');
  }
});

// Route for DM interface, protected
router.get('/dm', checkDMAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dm.html'));
});

// Protect other DM-specific routes
// Scene Routes
router.post('/createScene', checkDMAuth, sceneController.createScene);
router.get('/scenes', sceneController.getScenes); // Players can view scenes
router.post('/updateScene', checkDMAuth, sceneController.updateScene);
router.post('/deleteScene', checkDMAuth, sceneController.deleteScene);
router.post('/updateSceneOrder', checkDMAuth, sceneController.updateSceneOrder);

// Upload Routes
router.post('/upload', checkDMAuth, uploadController.uploadFile);

// Music Routes
router.post('/uploadMusic', checkDMAuth, musicController.uploadMusic);
router.get('/musicList', musicController.getMusicList); // Players can get music list
router.post('/deleteMusic', checkDMAuth, musicController.deleteMusic);

module.exports = router;