const express = require('express');
const multer = require('multer');
const { analyze } = require('../controllers/foodController');

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage });

// Route to handle food analysis
router.post('/analyze', upload.single('image'), analyze);

module.exports = router;
