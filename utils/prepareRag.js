const { scrapeAndClean, scrapeMultiple } = require('./scraper');
const { processSearchResults } = require('./sourceRanker');
const { extractSmartContent, cleanText } = require('./chunker');
const config = require('../config');

/**
 * Prepare high-quality sources from search results with intelligent ranking and extraction
 */
async function prepareSourcesForRAG(searxResults, query) {
  console.log(`[PrepareRAG] Processing ${searxResults.length} search results`);

  // Step 1: Rank and filter results
  const rankedResults = processSearchResults(searxResults, query, config.maxSearchResults);
  
  if (rankedResults.length === 0) {
    console.warn('[PrepareRAG] No valid sources after filtering');
    return [];
  }

  console.log(`[PrepareRAG] Selected ${rankedResults.length} top sources`);

  // Step 2: Prepare sources (prefer search snippets, scrape only when necessary)
  const sources = [];
  const urlsToScrape = [];

  for (const result of rankedResults) {
    const url = result.url;
    let content = result.content?.trim();
    const title = result.title || 'Untitled';

    // Try to use search result content first (be aggressive to avoid scraping)
    if (content && content.length > 30) {
      const cleanedContent = cleanText(content);
      const smartContent = extractSmartContent(cleanedContent, query, config.maxContentLength);
      
      if (smartContent && smartContent.length > 30) {
        console.log(`[PrepareRAG] Using search snippet: ${url} (${smartContent.length} chars)`);
        sources.push({
          title,
          url,
          content: smartContent,
          relevanceScore: result.relevanceScore,
          fromSearch: true,
        });
        continue; // Skip scraping for this URL
      }
    }

    // Only scrape if search content is really insufficient
    // Note: Many sites return 403, so this is a fallback only
    if (urlsToScrape.length < 2) { // Limit scraping attempts to reduce 403 errors
      console.log(`[PrepareRAG] Will attempt scrape for: ${url}`);
      urlsToScrape.push({ url, title, result });
    } else {
      console.log(`[PrepareRAG] Skipping scrape (limit reached), insufficient content from: ${url}`);
    }
  }

  // Step 3: Scrape URLs in parallel (if needed) - Limited to reduce 403 errors
  if (urlsToScrape.length > 0) {
    console.log(`[PrepareRAG] Attempting to scrape ${urlsToScrape.length} URLs (Note: Many sites block scraping)`);
    
    const urls = urlsToScrape.map(item => item.url);
    const scrapeResults = await scrapeMultiple(urls, Math.min(config.maxConcurrentScrapes, 2));

    scrapeResults.forEach((scrapeResult, index) => {
      const { url, title, result } = urlsToScrape[index];
      
      if (scrapeResult.success && scrapeResult.content) {
        // Clean and extract relevant content
        const cleanedContent = cleanText(scrapeResult.content);
        const smartContent = extractSmartContent(cleanedContent, query, config.maxContentLength);
        
        if (smartContent && smartContent.length > 50) {
          console.log(`[PrepareRAG] Successfully scraped: ${url} (${smartContent.length} chars)`);
          sources.push({
            title,
            url,
            content: smartContent,
            relevanceScore: result.relevanceScore,
            fromScrape: true,
          });
        } else {
          console.warn(`[PrepareRAG] Scraped content too short: ${url}`);
        }
      } else {
        // Scraping failed (likely 403 or other block) - this is expected for many sites
        console.log(`[PrepareRAG] Scrape blocked (expected): ${scrapeResult.url}`);
      }
    });
  }

  // If we still don't have enough sources, we're limited by what SearXNG provides
  if (sources.length === 0) {
    console.warn('[PrepareRAG] No sources available - search results may be insufficient or sites blocking scraping');
  }

  console.log(`[PrepareRAG] Final source count: ${sources.length}`);

  // Sort by relevance score
  sources.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return sources;
}

module.exports = { prepareSourcesForRAG };