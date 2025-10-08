const NodeCache = require('node-cache');
const crypto = require('crypto');
const config = require('../config');

/**
 * Multi-purpose cache manager with different TTLs for different data types
 */
class CacheManager {
  constructor() {
    // Separate caches for different data types
    this.searchCache = new NodeCache({ 
      stdTTL: config.cache.searchTTL,
      checkperiod: 120,
      useClones: false, // Better performance
    });
    
    this.scrapeCache = new NodeCache({ 
      stdTTL: config.cache.scrapeTTL,
      checkperiod: 600,
      useClones: false,
    });
    
    this.llmCache = new NodeCache({ 
      stdTTL: config.cache.llmTTL,
      checkperiod: 120,
      useClones: false,
    });

    // Track statistics
    this.stats = {
      searchHits: 0,
      searchMisses: 0,
      scrapeHits: 0,
      scrapeMisses: 0,
      llmHits: 0,
      llmMisses: 0,
    };
  }

  /**
   * Generate cache key from input
   */
  generateKey(prefix, input) {
    const normalized = typeof input === 'string' 
      ? input.toLowerCase().trim()
      : JSON.stringify(input);
    
    const hash = crypto.createHash('md5').update(normalized).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Search results cache
   */
  getSearch(query) {
    if (!config.features.caching) return null;
    
    const key = this.generateKey('search', query);
    const value = this.searchCache.get(key);
    
    if (value) {
      this.stats.searchHits++;
      console.log(`[Cache] Search HIT: "${query}"`);
    } else {
      this.stats.searchMisses++;
    }
    
    return value;
  }

  setSearch(query, results) {
    if (!config.features.caching) return;
    
    const key = this.generateKey('search', query);
    this.searchCache.set(key, results);
    console.log(`[Cache] Search SET: "${query}" (${results.length} results)`);
  }

  /**
   * Scraped content cache
   */
  getScrape(url) {
    if (!config.features.caching) return null;
    
    const key = this.generateKey('scrape', url);
    const value = this.scrapeCache.get(key);
    
    if (value) {
      this.stats.scrapeHits++;
      console.log(`[Cache] Scrape HIT: ${url}`);
    } else {
      this.stats.scrapeMisses++;
    }
    
    return value;
  }

  setScrape(url, content) {
    if (!config.features.caching) return;
    
    const key = this.generateKey('scrape', url);
    this.scrapeCache.set(key, content);
    console.log(`[Cache] Scrape SET: ${url}`);
  }

  /**
   * LLM response cache
   */
  getLLM(prompt) {
    if (!config.features.caching) return null;
    
    const key = this.generateKey('llm', prompt);
    const value = this.llmCache.get(key);
    
    if (value) {
      this.stats.llmHits++;
      console.log(`[Cache] LLM HIT: ${prompt.slice(0, 50)}...`);
    } else {
      this.stats.llmMisses++;
    }
    
    return value;
  }

  setLLM(prompt, response) {
    if (!config.features.caching) return;
    
    const key = this.generateKey('llm', prompt);
    this.llmCache.set(key, response);
    console.log(`[Cache] LLM SET: ${prompt.slice(0, 50)}...`);
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.searchCache.flushAll();
    this.scrapeCache.flushAll();
    this.llmCache.flushAll();
    console.log('[Cache] All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const searchTotal = this.stats.searchHits + this.stats.searchMisses;
    const scrapeTotal = this.stats.scrapeHits + this.stats.scrapeMisses;
    const llmTotal = this.stats.llmHits + this.stats.llmMisses;

    return {
      search: {
        hits: this.stats.searchHits,
        misses: this.stats.searchMisses,
        hitRate: searchTotal > 0 ? (this.stats.searchHits / searchTotal * 100).toFixed(2) + '%' : 'N/A',
        keys: this.searchCache.keys().length,
      },
      scrape: {
        hits: this.stats.scrapeHits,
        misses: this.stats.scrapeMisses,
        hitRate: scrapeTotal > 0 ? (this.stats.scrapeHits / scrapeTotal * 100).toFixed(2) + '%' : 'N/A',
        keys: this.scrapeCache.keys().length,
      },
      llm: {
        hits: this.stats.llmHits,
        misses: this.stats.llmMisses,
        hitRate: llmTotal > 0 ? (this.stats.llmHits / llmTotal * 100).toFixed(2) + '%' : 'N/A',
        keys: this.llmCache.keys().length,
      },
    };
  }
}

// Singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;
