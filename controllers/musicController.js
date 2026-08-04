// controllers/musicController.js
const path = require('path');
const fs = require('fs').promises;
const createUploader = require('../middlewares/upload');

const MUSIC_DIR = path.join(__dirname, '..', 'public', 'music');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);

const upload = createUploader({ directory: MUSIC_DIR, field: 'music', accept: ['audio/'] });

/** Drop the upload timestamp prefix and extension for display. */
const displayName = (filename) =>
  path.basename(filename, path.extname(filename)).replace(/^\d+\s*[-_]?\s*/, '');

const trackFor = (filename) => ({
  name: displayName(filename),
  filename,
  url: `/music/${encodeURIComponent(filename)}`,
});

exports.uploadMusic = (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No music file uploaded.' });
    }
    res.json({ success: true, track: trackFor(req.file.filename) });
  });
};

exports.getMusicList = async (req, res) => {
  try {
    const files = await fs.readdir(MUSIC_DIR);
    const tracks = files
      .filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .map(trackFor);
    res.json({ success: true, tracks });
  } catch (err) {
    console.error('Error reading music directory:', err.message);
    res.status(500).json({ success: false, message: 'Error reading music directory.' });
  }
};

exports.deleteMusic = async (req, res) => {
  const filename = path.basename(String(req.body.filename ?? ''));
  if (!filename) {
    return res.status(400).json({ success: false, message: 'No filename provided.' });
  }

  try {
    await fs.unlink(path.join(MUSIC_DIR, filename));
    res.json({ success: true });
  } catch (err) {
    const missing = err.code === 'ENOENT';
    if (!missing) console.error('Error deleting music file:', err.message);
    res.status(missing ? 404 : 500).json({
      success: false,
      message: missing ? 'File not found.' : 'Error deleting file.',
    });
  }
};
