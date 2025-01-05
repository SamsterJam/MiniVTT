// controllers/musicController.js
const uploadMusic = require('../middlewares/multerMusic');
const path = require('path');
const fs = require('fs');

exports.uploadMusic = (req, res) => {
  uploadMusic.single('music')(req, res, (err) => {
    if (err) {
      console.error('Music upload error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No music file uploaded.' });
    }

    console.log(`Music uploaded: ${req.file.filename}`);

    res.json({
      success: true,
      musicUrl: `/music/${req.file.filename}`,
      filename: req.file.filename
    });
  });
};

exports.getMusicList = (req, res) => {
  const musicDir = path.join(__dirname, '..', 'public', 'music');
  fs.readdir(musicDir, (err, files) => {
    if (err) {
      console.error('Error reading music directory:', err);
      return res.status(500).json({ success: false, message: 'Error reading music directory.' });
    }
    const musicFiles = files.filter(file => {
      return (
        file.endsWith('.mp3') ||
        file.endsWith('.wav') ||
        file.endsWith('.ogg') ||
        file.endsWith('.m4a') ||
        file.endsWith('.flac')
      );
    });
    const musicTracks = musicFiles.map(file => {
      return {
        name: file.replace(/^\d+\s*[-_]?\s*/, ''),
        filename: file,
        url: '/music/' + file
      };
    });
    res.json({ success: true, musicTracks });
  });
};

exports.deleteMusic = (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ success: false, message: 'No filename provided.' });
  }
  const musicDir = path.join(__dirname, '..', 'public', 'music');
  const safeFilename = path.basename(filename);
  const filePath = path.join(musicDir, safeFilename);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('Music file does not exist:', filePath);
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting music file:', err);
        return res.status(500).json({ success: false, message: 'Error deleting file.' });
      }
      console.log('Deleted music file:', filePath);
      res.json({ success: true });
    });
  });
};