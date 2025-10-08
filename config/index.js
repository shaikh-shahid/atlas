require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // External Services
  searxng: {
    url: process.env.SEARXNG_URL || 'http://localhost:32768',
  },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3',
  },

  // Performance
  maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS, 10) || 5,
  maxConcurrentScrapes: parseInt(process.env.MAX_CONCURRENT_SCRAPES, 10) || 5,
  scrapeTimeout: parseInt(process.env.SCRAPE_TIMEOUT, 10) || 10000,
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,

  // Cache TTLs (in seconds)
  cache: {
    searchTTL: parseInt(process.env.CACHE_SEARCH_TTL, 10) || 1800, // 30 min
    scrapeTTL: parseInt(process.env.CACHE_SCRAPE_TTL, 10) || 86400, // 24 hours
    llmTTL: parseInt(process.env.CACHE_LLM_TTL, 10) || 3600, // 1 hour
  },

  // Content
  maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH, 10) || 2000,
  maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES, 10) || 20,

  // Feature Flags
  features: {
    caching: process.env.ENABLE_CACHING === 'true',
    streaming: process.env.ENABLE_STREAMING === 'true',
    queryRewriting: process.env.ENABLE_QUERY_REWRITING === 'true',
  },
};

module.exports = config;
