const axios = require('axios');
const { JSDOM } = require('jsdom');
const UserAgent = require('user-agents');
const { Readability } = require('@mozilla/readability');
const config = require('../config');
const cache = require('./cache');

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrape and extract clean content from URL with retry logic
 */
async function scrapeAndClean(url, retries = 3) {
  // Check cache first
  const cached = cache.getScrape(url);
  if (cached) return cached;

  console.log(`[Scraper] Crawling: ${url}`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { wrapper } = await import('axios-cookiejar-support');
      const tough = await import('tough-cookie');

      const jar = new tough.CookieJar();
      const client = wrapper(axios.create({ 
        jar,
        timeout: config.scrapeTimeout,
      }));

      const headers = {
        'User-Agent': new UserAgent().toString(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': url,
      };

      const res = await client.get(url, { headers });

      const dom = new JSDOM(res.data, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article || !article.textContent) {
        throw new Error('No content extracted from page');
      }

      const content = article.textContent.trim();
      
      if (content.length < 100) {
        throw new Error('Content too short (possible scraping failure)');
      }

      console.log(`[Scraper] Success: ${url} (${content.length} chars)`);
      
      // Cache the result
      cache.setScrape(url, content);
      
      return content;

    } catch (error) {
      console.warn(`[Scraper] Attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
      
      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[Scraper] Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        // All retries exhausted
        console.error(`[Scraper] Failed after ${retries} attempts: ${url}`);
        throw new Error(`Failed to scrape ${url}: ${error.message}`);
      }
    }
  }

  return '';
}

/**
 * Scrape multiple URLs in parallel with concurrency limit
 */
async function scrapeMultiple(urls, maxConcurrent = 5) {
  console.log(`[Scraper] Scraping ${urls.length} URLs (max ${maxConcurrent} concurrent)`);
  
  const results = [];
  const executing = [];

  for (const url of urls) {
    const promise = scrapeAndClean(url)
      .then(content => ({ url, content, success: true }))
      .catch(error => ({ url, content: null, success: false, error: error.message }));

    results.push(promise);

    if (maxConcurrent <= urls.length) {
      const e = promise.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

module.exports = { scrapeAndClean, scrapeMultiple };
