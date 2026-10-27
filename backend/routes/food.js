const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { analyze, list } = require('../controllers/foodController');

const router = express.Router();

// Photos stay in memory: they're classified and dropped, never written to disk.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

router.post('/analyze', auth, upload.single('image'), analyze);
router.get('/', auth, list);

module.exports = router;
