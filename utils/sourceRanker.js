/**
 * Source ranking and filtering for better RAG quality
 */

// Authoritative domains get priority
const AUTHORITATIVE_DOMAINS = [
  'wikipedia.org',
  'britannica.com',
  '.edu',
  '.gov',
  'nih.gov',
  'cdc.gov',
  'nature.com',
  'sciencedirect.com',
  'arxiv.org',
  'scholar.google.com',
  'reuters.com',
  'bbc.com',
  'nytimes.com',
  'theguardian.com',
  'stackoverflow.com',
  'github.com',
  'mozilla.org',
  'w3.org',
];

// Low-quality domains to filter out
const LOW_QUALITY_PATTERNS = [
  'pinterest.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com', // Can be noisy, filter for now
  'quora.com', // Often low quality
  'answers.yahoo.com',
  'ask.com',
  'ehow.com',
];

// Paywalled or problematic sites
const BLOCKED_DOMAINS = [
  'medium.com/m/', // Paywall indicator
  'paywallz.com',
  'wsj.com',
  'ft.com',
];

/**
 * Calculate relevance score for a search result
 */
function calculateRelevanceScore(result, query) {
  let score = 0;
  
  const title = (result.title || '').toLowerCase();
  const content = (result.content || '').toLowerCase();
  const url = (result.url || '').toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // Title relevance (highest weight)
  if (title.includes(queryLower)) {
    score += 10;
  } else {
    // Partial match
    const titleMatches = queryWords.filter(word => title.includes(word)).length;
    score += titleMatches * 2;
  }

  // Content relevance
  if (content.includes(queryLower)) {
    score += 5;
  } else {
    // Partial match
    const contentMatches = queryWords.filter(word => content.includes(word)).length;
    score += contentMatches;
  }

  // URL relevance
  const urlMatches = queryWords.filter(word => url.includes(word)).length;
  score += urlMatches * 0.5;

  // Authoritative domain bonus
  if (AUTHORITATIVE_DOMAINS.some(domain => url.includes(domain))) {
    score += 15;
  }

  // Content length bonus (but not too long)
  const contentLength = content.length;
  if (contentLength > 100 && contentLength < 5000) {
    score += 3;
  } else if (contentLength >= 5000) {
    score += 1;
  }

  // Recency bonus (if available)
  if (result.publishedDate) {
    const publishedDate = new Date(result.publishedDate);
    const now = new Date();
    const daysSincePublished = (now - publishedDate) / (1000 * 60 * 60 * 24);
    
    if (daysSincePublished < 30) {
      score += 5;
    } else if (daysSincePublished < 365) {
      score += 2;
    }
  }

  return score;
}

/**
 * Check if URL should be blocked
 */
function shouldBlock(url) {
  const urlLower = url.toLowerCase();
  return BLOCKED_DOMAINS.some(domain => urlLower.includes(domain));
}

/**
 * Check if URL is low quality
 */
function isLowQuality(url) {
  const urlLower = url.toLowerCase();
  return LOW_QUALITY_PATTERNS.some(pattern => urlLower.includes(pattern));
}

/**
 * Filter and rank search results
 */
function rankAndFilterResults(results, query, maxResults = 10) {
  console.log(`[SourceRanker] Processing ${results.length} results`);

  // Filter out blocked and low-quality sources
  let filtered = results.filter(result => {
    const url = result.url || '';
    
    if (shouldBlock(url)) {
      console.log(`[SourceRanker] Blocked: ${url}`);
      return false;
    }
    
    if (isLowQuality(url)) {
      console.log(`[SourceRanker] Low quality filtered: ${url}`);
      return false;
    }
    
    // Filter out results with very short or no content
    const content = result.content || '';
    if (content.length < 50) {
      console.log(`[SourceRanker] Insufficient content: ${url}`);
      return false;
    }
    
    return true;
  });

  console.log(`[SourceRanker] After filtering: ${filtered.length} results`);

  // Calculate scores
  const scored = filtered.map(result => ({
    ...result,
    relevanceScore: calculateRelevanceScore(result, query),
  }));

  // Sort by score (highest first)
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Log top results
  console.log('[SourceRanker] Top ranked sources:');
  scored.slice(0, Math.min(5, scored.length)).forEach((result, i) => {
    console.log(`  ${i + 1}. [Score: ${result.relevanceScore}] ${result.title || 'Untitled'} - ${result.url}`);
  });

  // Return top N results
  return scored.slice(0, maxResults);
}

/**
 * Deduplicate results by domain
 */
function deduplicateByDomain(results, maxPerDomain = 2) {
  const domainCount = {};
  
  return results.filter(result => {
    try {
      const url = new URL(result.url);
      const domain = url.hostname;
      
      domainCount[domain] = (domainCount[domain] || 0) + 1;
      
      if (domainCount[domain] > maxPerDomain) {
        console.log(`[SourceRanker] Skipping duplicate domain: ${domain}`);
        return false;
      }
      
      return true;
    } catch (error) {
      // Invalid URL, skip
      return false;
    }
  });
}

/**
 * Main function: rank, filter, and deduplicate results
 */
function processSearchResults(results, query, maxResults = 10) {
  // Step 1: Rank and filter
  let processed = rankAndFilterResults(results, query, maxResults * 2);
  
  // Step 2: Deduplicate
  processed = deduplicateByDomain(processed, 2);
  
  // Step 3: Final limit
  processed = processed.slice(0, maxResults);
  
  console.log(`[SourceRanker] Final selection: ${processed.length} sources`);
  
  return processed;
}

module.exports = {
  processSearchResults,
  rankAndFilterResults,
  deduplicateByDomain,
  calculateRelevanceScore,
};
