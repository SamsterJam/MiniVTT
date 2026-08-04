// middlewares/upload.js
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const MAX_FILE_SIZE = 512 * 1024 * 1024;

// Keep the name readable, but strip anything that could escape the destination
// directory or need escaping in a URL. The prefix stops names colliding.
function safeFilename(originalname) {
  const base = path
    .basename(originalname)
    .replace(/[^\w.\- ]+/g, '_')
    .slice(-120);
  return `${Date.now()}-${base || 'file'}`;
}

// `accept` is a list of permitted MIME type prefixes, e.g. ['image/', 'video/'].
module.exports = function createUploader({ directory, field, accept }) {
  fs.mkdirSync(directory, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, directory),
      filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) =>
      accept.some((prefix) => file.mimetype.startsWith(prefix))
        ? cb(null, true)
        : cb(new Error(`Unsupported file type: ${file.mimetype}`)),
  }).single(field);
};
