const axios = require('axios');
const config = require('../config');
const cache = require('./cache');

/**
 * Search using SearXNG with caching
 */
async function searchSearxng(query) {
  // Check cache first
  const cached = cache.getSearch(query);
  if (cached) {
    console.log(`[SearXNG] Using cached results for: "${query}"`);
    return cached;
  }

  console.log(`[SearXNG] Searching for: "${query}"`);
  
  try {
    const res = await axios.get(`${config.searxng.url}/search`, {
      params: {
        q: query,
        format: 'json',
      },
      timeout: config.requestTimeout,
    });

    const results = res.data.results || [];
    console.log(`[SearXNG] Found ${results.length} results`);
    
    // Cache the results
    cache.setSearch(query, results);
    
    return results;
  } catch (error) {
    console.error(`[SearXNG] Search failed: ${error.message}`);
    throw new Error(`Search service unavailable: ${error.message}`);
  }
}

module.exports = { searchSearxng };
