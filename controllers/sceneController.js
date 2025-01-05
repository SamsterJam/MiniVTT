// controllers/sceneController.js
const Scene = require('../models/sceneModel');

// Function to create a new scene
exports.createScene = async (req, res) => {
  const { sceneName } = req.body;
  const sceneId = Date.now().toString();

  const newScene = {
    sceneId,
    sceneName,
    tokens: [],
  };

  // Save the new scene immediately
  await Scene.saveScene(newScene);
  Scene.addScene(newScene);

  res.json({ sceneId });
};

// Function to get the list of scenes
exports.getScenes = (req, res) => {
  Scene.getAllScenes()
    .then((scenes) => {
      res.json({ scenes });
    })
    .catch((err) => {
      console.error('Error getting scenes:', err);
      res.status(500).send('Error getting scenes.');
    });
};

// Function to update a scene
exports.updateScene = async (req, res) => {
  const { scene } = req.body;
  try {
    await Scene.updateScene(scene);
    res.json({ message: 'Scene updated.' });
  } catch (err) {
    console.error('Error updating scene:', err);
    res.status(500).send('Error updating scene.');
  }
};

// Function to delete a scene
exports.deleteScene = async (req, res) => {
  const { sceneId } = req.body;
  try {
    await Scene.deleteScene(sceneId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting scene:', err);
    res.status(500).json({ success: false, message: 'Error deleting scene.' });
  }
};

// Function to update scene order
exports.updateSceneOrder = async (req, res) => {
  const { sceneOrder } = req.body;
  try {
    await Scene.updateSceneOrder(sceneOrder);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating scene order:', err);
    res.json({ success: false, message: 'Failed to update scene order' });
  }
};