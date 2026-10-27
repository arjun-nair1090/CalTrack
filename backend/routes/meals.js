const express = require('express');
const auth = require('../middleware/auth');
const { add, forDay, remove } = require('../controllers/mealController');

const router = express.Router();

router.use(auth);
router.get('/', forDay);
router.post('/', add);
router.delete('/:id', remove);

module.exports = router;
