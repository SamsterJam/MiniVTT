// controllers/musicController.js
const path = require('path');
const createUploader = require('../middlewares/upload');
const Music = require('../models/musicModel');

const upload = createUploader({
  directory: path.join(__dirname, '..', 'public', 'music'),
  field: 'music',
  accept: ['audio/'],
});

// The only music route on HTTP; playback and deletion go over the socket.
exports.uploadMusic = (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No music file uploaded.' });
    }

    // Registering announces the new track to everyone.
    Music.add(req.file.filename);
    res.json({ success: true });
  });
};
