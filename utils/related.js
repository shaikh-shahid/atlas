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
    
    console.log('[Related] Raw response:', response);
    
    // Try multiple parsing strategies
    let questions = [];
    
    // Strategy 1: Try to parse as JSON
    try {
      const parsed = JSON.parse(response.trim());
      if (Array.isArray(parsed)) {
        questions = parsed.slice(0, 5);
        console.log('[Related] Successfully parsed JSON:', questions);
        return questions;
      }
    } catch (parseError) {
      console.log('[Related] JSON parse failed, trying extraction...');
    }
    
    // Strategy 2: Look for JSON array in the text
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          questions = parsed.slice(0, 5);
          console.log('[Related] Extracted JSON from text:', questions);
          return questions;
        }
      } catch (e) {
        console.log('[Related] JSON extraction failed');
      }
    }
    
    // Strategy 3: Extract questions from text
    questions = extractQuestionsFromText(response);
    console.log('[Related] Extracted from text:', questions);
    
    return questions.slice(0, 5);
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
  
  // Split by common delimiters
  const lines = text.split(/\n|,(?=\s*")/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Remove numbering, quotes, and brackets
    const cleaned = trimmed
      .replace(/^\d+[\.)]\s*/, '') // Remove "1. " or "1) "
      .replace(/^[-*•]\s*/, '') // Remove "- " or "* " or "• "
      .replace(/^["'\[\]]+|["'\[\]]+$/g, '') // Remove quotes and brackets
      .trim();
    
    // Check if it's a valid question
    if (cleaned.length > 15 && cleaned.length < 150 && cleaned.includes('?')) {
      // Clean up any remaining artifacts
      const finalClean = cleaned
        .replace(/^\s*["']/, '') // Remove leading quotes
        .replace(/["']\s*$/, '') // Remove trailing quotes
        .trim();
      
      if (finalClean && !questions.includes(finalClean)) {
        questions.push(finalClean);
      }
    }
  }
  
  return questions;
}

module.exports = { generateRelatedQuestions };