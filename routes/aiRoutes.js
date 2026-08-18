// routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// POST /api/ai/generate — Gemini AI content generation (chat + tools)
router.post('/generate', aiController.generateContent);

// GET /api/ai/generate — helpful response for browser direct access
router.get('/generate', (req, res) => {
    res.status(405).json({
        success: false,
        message: 'VMS AI endpoint is active. Use POST /api/ai/generate with JSON body { action, payload }.',
        method_required: 'POST',
        docs: 'https://github.com/Aman-Kashyap-310304/VMS-Ultimator#-api-reference'
    });
});

module.exports = router;
