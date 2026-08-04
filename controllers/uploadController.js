// controllers/uploadController.js
const path = require('path');
const createUploader = require('../middlewares/upload');

const upload = createUploader({
  directory: path.join(__dirname, '..', 'public', 'uploads'),
  field: 'file',
  accept: ['image/', 'video/'],
});

exports.uploadFile = (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    res.json({
      imageUrl: `/uploads/${encodeURIComponent(req.file.filename)}`,
      mediaType: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
    });
  });
};
