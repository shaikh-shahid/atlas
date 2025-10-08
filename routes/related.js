const express = require('express');
const router = express.Router();
const { generateRelatedQuestions } = require('../utils/related');

/**
 * Generate related questions based on user query
 */
router.post('/', async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ error: 'Invalid question' });
    }

    console.log(`[Related] Generating questions for: "${question}"`);
    
    const relatedQuestions = await generateRelatedQuestions(question, answer);
    
    console.log(`[Related] Generated ${relatedQuestions.length} questions`);
    
    res.json({ related: relatedQuestions });
  } catch (error) {
    console.error('[Related] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate related questions',
      related: [], // Return empty array as fallback
    });
  }
});

module.exports = router;