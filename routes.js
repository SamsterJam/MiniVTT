// routes.js
const express = require('express');
const router = express.Router();
const path = require('path');

// Controllers
const sceneController = require('./controllers/sceneController');
const uploadController = require('./controllers/uploadController');
const musicController = require('./controllers/musicController');

// Route for DM interface
router.get('/dm', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dm.html'));
});

// Scene Routes
router.post('/createScene', sceneController.createScene);
router.get('/scenes', sceneController.getScenes);
router.post('/updateScene', sceneController.updateScene);
router.post('/deleteScene', sceneController.deleteScene);
router.post('/updateSceneOrder', sceneController.updateSceneOrder);

// Upload Routes
router.post('/upload', uploadController.uploadFile);

// Music Routes
router.post('/uploadMusic', musicController.uploadMusic);
router.get('/musicList', musicController.getMusicList);
router.post('/deleteMusic', musicController.deleteMusic);

module.exports = router;