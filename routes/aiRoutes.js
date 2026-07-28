// routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// POST /api/ai/generate — Gemini AI content generation (chat + tools)
router.post('/generate', aiController.generateContent);

module.exports = router;
