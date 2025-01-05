// middlewares/multerMusic.js
const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'public/music/';
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadMusic = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const mimeType = file.mimetype;
    if (mimeType.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

module.exports = uploadMusic;