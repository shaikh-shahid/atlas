const { queryOllama } = require('./ollama');
const prompts = require('./prompts');

/**
 * Generate related questions based on a query and optional answer
 */
async function generateRelatedQuestions(question, answer = null) {
  const prompt = prompts.relatedQuestions(question, answer);
  
  try {
    const response = await queryOllama(prompt, {
      useCache: true,
      temperature: 0.8, // Higher temperature for more diverse questions
    });
    
    console.log('[Related] Generated questions:', response);
    
    // Try to parse JSON response
    try {
      const parsed = JSON.parse(response.trim());
      
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 5); // Ensure max 5 questions
      }
    } catch (parseError) {
      console.warn('[Related] Failed to parse JSON, attempting extraction');
      
      // Fallback: extract questions from text
      const questions = extractQuestionsFromText(response);
      return questions.slice(0, 5);
    }
    
    return [];
  } catch (error) {
    console.error('[Related] Generation failed:', error.message);
    return [];
  }
}

/**
 * Extract questions from text response (fallback)
 */
function extractQuestionsFromText(text) {
  const questions = [];
  
  // Try to find lines that look like questions
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Remove numbering and quotes
    const cleaned = trimmed
      .replace(/^\d+\.\s*/, '') // Remove "1. "
      .replace(/^[-*]\s*/, '') // Remove "- " or "* "
      .replace(/^["']|["']$/g, ''); // Remove quotes
    
    if (cleaned.length > 10 && cleaned.length < 100 && cleaned.includes('?')) {
      questions.push(cleaned);
    }
  }
  
  return questions;
}

module.exports = { generateRelatedQuestions };