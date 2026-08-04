// controllers/sceneController.js
const Scene = require('../models/sceneModel');

exports.getScenes = (req, res) => {
  res.json({ scenes: Scene.listScenes() });
};

exports.createScene = (req, res) => {
  const { sceneId } = Scene.createScene(req.body.sceneName);
  res.json({ sceneId });
};

exports.deleteScene = async (req, res) => {
  try {
    await Scene.deleteScene(req.body.sceneId);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

exports.updateSceneOrder = (req, res) => {
  const { sceneOrder } = req.body;
  if (!Array.isArray(sceneOrder)) {
    return res.status(400).json({ success: false, message: 'sceneOrder must be an array.' });
  }
  Scene.reorderScenes(sceneOrder);
  res.json({ success: true });
};
