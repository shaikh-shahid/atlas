/**
 * Intelligent text chunking and relevance extraction
 */

/**
 * Split text into semantic chunks (by paragraphs/sections)
 */
function splitIntoChunks(text, maxChunkSize = 500) {
  if (!text || text.length === 0) return [];

  // Split by double newlines (paragraphs) first
  let chunks = text.split(/\n\n+/).filter(chunk => chunk.trim().length > 0);

  // If chunks are too large, split further by single newlines
  chunks = chunks.flatMap(chunk => {
    if (chunk.length <= maxChunkSize) {
      return [chunk];
    }
    
    // Split by sentences
    const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const subChunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length < maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
      } else {
        if (currentChunk) subChunks.push(currentChunk);
        currentChunk = sentence.trim();
      }
    }
    
    if (currentChunk) subChunks.push(currentChunk);
    return subChunks;
  });

  return chunks.map(chunk => chunk.trim()).filter(chunk => chunk.length > 20);
}

/**
 * Calculate relevance score for a chunk against a query
 */
function scoreChunk(chunk, query) {
  const chunkLower = chunk.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  let score = 0;
  
  // Exact phrase match (highest score)
  if (chunkLower.includes(queryLower)) {
    score += 20;
  }
  
  // Individual word matches
  queryWords.forEach(word => {
    if (chunkLower.includes(word)) {
      score += 3;
      
      // Bonus for word appearing multiple times
      const occurrences = (chunkLower.match(new RegExp(word, 'g')) || []).length;
      if (occurrences > 1) {
        score += (occurrences - 1);
      }
    }
  });
  
  // Position bonus (earlier chunks are often more relevant)
  // This will be applied when sorting with index
  
  // Length penalty for very short chunks
  if (chunk.length < 50) {
    score *= 0.5;
  }
  
  return score;
}

/**
 * Extract most relevant chunks from text based on query
 */
function extractRelevantChunks(text, query, maxChunks = 5, maxChunkSize = 500) {
  const chunks = splitIntoChunks(text, maxChunkSize);
  
  if (chunks.length === 0) return '';
  
  // Score each chunk
  const scoredChunks = chunks.map((chunk, index) => ({
    text: chunk,
    score: scoreChunk(chunk, query),
    index, // Track original position
  }));
  
  // Sort by score (with position bonus)
  scoredChunks.sort((a, b) => {
    // Add position bonus (earlier = better)
    const scoreA = a.score + (chunks.length - a.index) * 0.5;
    const scoreB = b.score + (chunks.length - b.index) * 0.5;
    return scoreB - scoreA;
  });
  
  // Take top N chunks
  const topChunks = scoredChunks.slice(0, maxChunks);
  
  // Re-sort by original position for coherent reading
  topChunks.sort((a, b) => a.index - b.index);
  
  // Join chunks
  return topChunks.map(c => c.text).join('\n\n');
}

/**
 * Smart content extraction: get most relevant parts of content
 */
function extractSmartContent(content, query, maxLength = 2000) {
  if (!content || content.length === 0) return '';
  
  // If content is short enough, return as-is
  if (content.length <= maxLength) {
    return content;
  }
  
  // Otherwise, extract relevant chunks
  const maxChunks = Math.ceil(maxLength / 400); // ~400 chars per chunk
  return extractRelevantChunks(content, query, maxChunks, 400);
}

/**
 * Clean and normalize text
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines (keep max 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove common boilerplate
    .replace(/cookie policy|privacy policy|terms of service|sign up for our newsletter/gi, '')
    // Trim
    .trim();
}

module.exports = {
  splitIntoChunks,
  scoreChunk,
  extractRelevantChunks,
  extractSmartContent,
  cleanText,
};
