const express = require('express');
const { analyzeFood } = require('../controllers/foodController'); // Correct path to the controller

const router = express.Router();

// Define the POST route for food analysis
router.post('/analyze', analyzeFood); // Ensure analyzeFood is correctly imported

module.exports = router;
