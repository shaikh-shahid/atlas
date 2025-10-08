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

  // Step 2: Prepare sources (with fallback scraping)
  const sources = [];
  const urlsToScrape = [];

  for (const result of rankedResults) {
    const url = result.url;
    let content = result.content?.trim();
    const title = result.title || 'Untitled';

    // Check if we need to scrape
    if (!content || content.length < 100) {
      urlsToScrape.push({ url, title, result });
    } else {
      // Use search result content
      const cleanedContent = cleanText(content);
      const smartContent = extractSmartContent(cleanedContent, query, config.maxContentLength);
      
      if (smartContent && smartContent.length > 50) {
        console.log(`[PrepareRAG] Using search content for: ${url}`);
        sources.push({
          title,
          url,
          content: smartContent,
          relevanceScore: result.relevanceScore,
        });
      } else {
        urlsToScrape.push({ url, title, result });
      }
    }
  }

  // Step 3: Scrape URLs in parallel (if needed)
  if (urlsToScrape.length > 0) {
    console.log(`[PrepareRAG] Scraping ${urlsToScrape.length} URLs`);
    
    const urls = urlsToScrape.map(item => item.url);
    const scrapeResults = await scrapeMultiple(urls, config.maxConcurrentScrapes);

    scrapeResults.forEach((scrapeResult, index) => {
      if (scrapeResult.success && scrapeResult.content) {
        const { url, title, result } = urlsToScrape[index];
        
        // Clean and extract relevant content
        const cleanedContent = cleanText(scrapeResult.content);
        const smartContent = extractSmartContent(cleanedContent, query, config.maxContentLength);
        
        if (smartContent && smartContent.length > 50) {
          sources.push({
            title,
            url,
            content: smartContent,
            relevanceScore: result.relevanceScore,
          });
        } else {
          console.warn(`[PrepareRAG] Insufficient content from scraped: ${url}`);
        }
      } else {
        console.warn(`[PrepareRAG] Scraping failed: ${scrapeResult.url} - ${scrapeResult.error}`);
      }
    });
  }

  console.log(`[PrepareRAG] Final source count: ${sources.length}`);

  // Sort by relevance score
  sources.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return sources;
}

module.exports = { prepareSourcesForRAG };