const axios = require('axios');
const config = require('../config');
const cache = require('./cache');

let context = [];
let currentTopic = null;

/**
 * Query Ollama with optional streaming support
 */
async function queryOllama(prompt, options = {}) {
  const {
    useCache = true,
    stream = false,
    onToken = null, // Callback for streaming tokens
    temperature = 0.7,
  } = options;

  // Check cache for non-streaming requests
  if (!stream && useCache) {
    const cached = cache.getLLM(prompt);
    if (cached) {
      console.log('[Ollama] Using cached response');
      return cached;
    }
  }

  console.log(`[Ollama] Generating response (stream: ${stream})`);

  try {
    if (stream && onToken) {
      // Streaming response
      return await streamOllamaResponse(prompt, onToken, temperature);
    } else {
      // Non-streaming response
      const response = await axios.post(`${config.ollama.url}/api/generate`, {
        model: config.ollama.model,
        prompt,
        stream: false,
        options: {
          temperature,
        },
      }, {
        timeout: config.requestTimeout,
      });

      const answer = response.data.response.trim();

      // Cache the response
      if (useCache) {
        cache.setLLM(prompt, answer);
      }

      return answer;
    }
  } catch (error) {
    console.error('[Ollama] Request failed:', error.message);
    throw new Error(`LLM service error: ${error.message}`);
  }
}

/**
 * Stream Ollama response with callback
 */
async function streamOllamaResponse(prompt, onToken, temperature = 0.7) {
  return new Promise((resolve, reject) => {
    let fullResponse = '';

    axios.post(`${config.ollama.url}/api/generate`, {
      model: config.ollama.model,
      prompt,
      stream: true,
      options: {
        temperature,
      },
    }, {
      responseType: 'stream',
      timeout: config.requestTimeout,
    }).then(response => {
      response.data.on('data', (chunk) => {
        try {
          const lines = chunk.toString().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            const data = JSON.parse(line);
            
            if (data.response) {
              fullResponse += data.response;
              onToken(data.response);
            }
            
            if (data.done) {
              console.log('[Ollama] Streaming complete');
              resolve(fullResponse.trim());
            }
          }
        } catch (error) {
          console.error('[Ollama] Stream parsing error:', error.message);
        }
      });

      response.data.on('error', (error) => {
        console.error('[Ollama] Stream error:', error.message);
        reject(error);
      });

      response.data.on('end', () => {
        if (fullResponse) {
          resolve(fullResponse.trim());
        }
      });
    }).catch(error => {
      console.error('[Ollama] Stream request failed:', error.message);
      reject(error);
    });
  });
}

/**
 * Query with conversation context
 */
async function queryWithContext(question, options = {}) {
  const prompt = context
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n') + `\nUser: ${question}\nAssistant:`;

  console.log(`[Ollama] Context size: ${context.length} messages`);

  const answer = await queryOllama(prompt, { ...options, useCache: false });

  // Save current turn
  context.push({ role: 'user', content: question });
  context.push({ role: 'assistant', content: answer });

  // Trim context if too long
  if (context.length > config.maxContextMessages) {
    context = context.slice(-config.maxContextMessages);
  }

  return answer;
}

/**
 * Clear conversation context
 */
function clearContext() {
  console.log('[Ollama] Context cleared');
  context = [];
  currentTopic = null;
}

/**
 * Get context summary
 */
function getContextInfo() {
  return {
    messageCount: context.length,
    topic: currentTopic,
    hasContext: context.length > 0,
  };
}

/**
 * Set current topic
 */
function setTopic(topic) {
  currentTopic = topic;
  console.log(`[Ollama] Topic set: ${topic}`);
}

module.exports = { 
  queryOllama, 
  queryWithContext,
  streamOllamaResponse,
  clearContext,
  getContextInfo,
  setTopic,
};
