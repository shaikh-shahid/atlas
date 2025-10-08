const axios = require('axios');
const config = require('../config');
const prompts = require('./prompts');
const cache = require('./cache');

/**
 * Query analyzer for context detection and query rewriting
 */
class QueryAnalyzer {
  constructor() {
    this.conversationHistory = [];
    this.currentTopic = null;
    this.lastQuery = null;
  }

  /**
   * Simple LLM call for analysis tasks (separate from main context)
   */
  async callLLM(prompt, useCache = true) {
    // Check cache first
    if (useCache) {
      const cached = cache.getLLM(prompt);
      if (cached) return cached;
    }

    try {
      const response = await axios.post(`${config.ollama.url}/api/generate`, {
        model: config.ollama.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent analysis
          num_predict: 100, // Short responses for analysis
        },
      });

      const answer = response.data.response.trim();
      
      // Cache the response
      if (useCache) {
        cache.setLLM(prompt, answer);
      }

      return answer;
    } catch (error) {
      console.error('[QueryAnalyzer] LLM call failed:', error.message);
      return null;
    }
  }

  /**
   * Detect if the new query is related to previous context
   */
  async isContextual(newQuery) {
    if (!config.features.queryRewriting) return false;
    if (!this.lastQuery) return false;

    const prompt = prompts.contextDetection(this.lastQuery, newQuery);
    const response = await this.callLLM(prompt);

    if (!response) return false;

    // Parse response (should be YES or NO)
    const isContextual = response.toUpperCase().includes('YES');
    
    console.log(`[QueryAnalyzer] Context check: "${newQuery}" -> ${isContextual ? 'CONTEXTUAL' : 'NEW TOPIC'}`);
    
    return isContextual;
  }

  /**
   * Rewrite query with context for better search results
   */
  async rewriteQuery(newQuery) {
    if (!config.features.queryRewriting) return newQuery;
    if (!this.lastQuery) return newQuery;

    // Get recent conversation summary
    const recentHistory = this.conversationHistory.slice(-3);

    const prompt = prompts.queryRewriting(this.lastQuery, newQuery, recentHistory);
    const rewritten = await this.callLLM(prompt);

    if (!rewritten) {
      console.log('[QueryAnalyzer] Rewriting failed, using original query');
      return newQuery;
    }

    console.log(`[QueryAnalyzer] Query rewritten: "${newQuery}" -> "${rewritten}"`);
    return rewritten.replace(/^["']|["']$/g, '').trim(); // Remove quotes if present
  }

  /**
   * Extract topic from query
   */
  async extractTopic(query) {
    const prompt = prompts.topicExtraction(query);
    const topic = await this.callLLM(prompt);
    
    if (topic) {
      console.log(`[QueryAnalyzer] Topic extracted: "${topic}"`);
      return topic;
    }
    
    return null;
  }

  /**
   * Process a new query: detect context, rewrite if needed
   */
  async processQuery(query) {
    const originalQuery = query;
    let processedQuery = query;
    let isContextual = false;

    // Check if this is a contextual query
    if (this.lastQuery) {
      isContextual = await this.isContextual(query);
      
      // Rewrite if contextual
      if (isContextual) {
        processedQuery = await this.rewriteQuery(query);
      } else {
        // New topic - clear old context
        console.log('[QueryAnalyzer] New topic detected, clearing context');
        this.clearContext();
      }
    }

    // Update topic
    if (!isContextual) {
      this.currentTopic = await this.extractTopic(processedQuery);
    }

    // Update history
    this.conversationHistory.push(originalQuery);
    if (this.conversationHistory.length > 5) {
      this.conversationHistory = this.conversationHistory.slice(-5);
    }

    this.lastQuery = originalQuery;

    return {
      original: originalQuery,
      processed: processedQuery,
      isContextual,
      topic: this.currentTopic,
    };
  }

  /**
   * Format query for search optimization
   */
  formatForSearch(query) {
    // Basic query formatting
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/[?!]+$/, ''); // Remove trailing punctuation
  }

  /**
   * Clear conversation context
   */
  clearContext() {
    console.log('[QueryAnalyzer] Context cleared');
    this.conversationHistory = [];
    this.currentTopic = null;
    this.lastQuery = null;
  }

  /**
   * Get current context summary
   */
  getContextSummary() {
    return {
      topic: this.currentTopic,
      lastQuery: this.lastQuery,
      historyLength: this.conversationHistory.length,
    };
  }
}

// Singleton instance
const queryAnalyzer = new QueryAnalyzer();

module.exports = queryAnalyzer;
