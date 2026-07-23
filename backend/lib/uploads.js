const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

// Only raster image formats are accepted. SVG is deliberately excluded even
// though browsers report it as "image/svg+xml" — an SVG can carry an
// embedded <script>, and anyone who later opens the uploaded file directly
// (e.g. an admin viewing a payment screenshot in a new tab) would run it in
// this site's origin. The extension used on disk always comes from this
// whitelist, never from the filename the uploader sent, which closes off
// tricks like "receipt.php.jpg" or a renamed executable.
const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function isAllowedImageMime(mimetype) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TO_EXT, mimetype);
}

// Cloudinary is optional — if the three env vars aren't set, every upload
// silently falls back to local disk (the old behaviour) so nothing breaks
// for anyone who hasn't set it up yet. The trade-off: on Render's free tier
// the local disk is wiped on every restart/redeploy, so anything saved
// locally (screenshots, banners, QR code, announcement images) can vanish.
// Setting CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// moves storage to Cloudinary, which persists across restarts.
const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `jay-janaki-tournament-centre/${folder}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

function saveBufferLocally(buffer, mimetype, folder) {
  const ext = ALLOWED_MIME_TO_EXT[mimetype] || '.jpg';
  const filename = `${folder}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const dir = path.join(__dirname, '..', 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

// Takes a multer memory-storage file object ({ buffer, mimetype }) and a
// folder name (e.g. 'screenshots', 'tournaments', 'settings', 'announcements').
// Returns the string to store in the DB: a full https:// Cloudinary URL, or a
// `/uploads/<folder>/<file>` relative path when Cloudinary isn't configured.
// Callers must have already rejected non-whitelisted mimetypes via
// isAllowedImageMime() in their multer fileFilter — this function trusts that.
async function saveUploadedImage(file, folder) {
  if (cloudinaryConfigured) {
    return uploadBufferToCloudinary(file.buffer, folder);
  }
  return saveBufferLocally(file.buffer, file.mimetype, folder);
}

module.exports = { cloudinaryConfigured, saveUploadedImage, isAllowedImageMime };
