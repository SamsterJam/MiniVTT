// controllers/uploadController.js
const upload = require('../middlewares/multerUpload');

exports.uploadFile = (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).send(err.message);
    }
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const mimeType = req.file.mimetype;
    let mediaType = 'image';
    if (mimeType.startsWith('video/')) {
      mediaType = 'video';
    } else if (mimeType.startsWith('image/')) {
      mediaType = 'image';
    } else {
      return res.status(400).send('Unsupported file type.');
    }

    res.json({ imageUrl: `/uploads/${req.file.filename}`, mediaType: mediaType });
  });
};