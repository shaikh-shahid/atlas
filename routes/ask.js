const express = require('express');
const router = express.Router();
const { queryOllama, clearContext } = require('../utils/ollama');
const { searchSearxng } = require('../utils/searxng');
const { prepareSourcesForRAG } = require('../utils/prepareRag');
const queryAnalyzer = require('../utils/queryAnalyzer');
const prompts = require('../utils/prompts');
const config = require('../config');

/**
 * Main ask route - with query analysis and optional streaming
 */
router.post('/', async (req, res) => {
  const { question, stream = false } = req.body;

  if (!question || question.length < 3) {
    return res.status(400).json({ error: 'Invalid question.' });
  }

  const startTime = Date.now();

  try {
    // Step 1: Analyze and process query
    console.log(`\n[Ask] New question: "${question}"`);
    const queryInfo = await queryAnalyzer.processQuery(question);
    
    console.log(`[Ask] Query analysis:`, {
      isContextual: queryInfo.isContextual,
      original: queryInfo.original,
      processed: queryInfo.processed,
      topic: queryInfo.topic,
    });

    const searchQuery = queryInfo.processed;

    // Step 2: Search for sources
    console.log(`[Ask] Searching for: "${searchQuery}"`);
    const searchResults = await searchSearxng(searchQuery);

    if (!searchResults || searchResults.length === 0) {
      return res.json({ 
        answer: "I couldn't find any relevant sources to answer your question. Please try rephrasing or asking something else.",
        citations: [],
        queryInfo,
      });
    }

    // Step 3: Prepare high-quality sources
    const sources = await prepareSourcesForRAG(searchResults, searchQuery);

    if (!sources.length) {
      return res.json({ 
        answer: "I found search results but couldn't extract useful content from them. Please try a different question.",
        citations: [],
        queryInfo,
      });
    }

    // Step 4: Format sources for RAG
    const formattedSources = sources.map((src, i) =>
      `[${i + 1}]\nTitle: ${src.title}\nSource: ${src.url}\n\n${src.content}`
    ).join('\n\n');

    // Step 5: Generate answer with improved prompt
    const prompt = prompts.answerGeneration(question, formattedSources);

    if (stream && config.features.streaming) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial metadata
      res.write(`data: ${JSON.stringify({ 
        type: 'metadata',
        sources: sources.map(s => ({ title: s.title, url: s.url })),
        queryInfo,
      })}\n\n`);

      let fullAnswer = '';

      await queryOllama(prompt, {
        stream: true,
        useCache: false,
        onToken: (token) => {
          fullAnswer += token;
          res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
        },
      });

      // Send completion
      res.write(`data: ${JSON.stringify({ 
        type: 'done',
        answer: fullAnswer.trim(),
        citations: sources.map(s => s.url),
        queryInfo,
        processingTime: Date.now() - startTime,
      })}\n\n`);

      res.end();
    } else {
      // Non-streaming response
      const summary = await queryOllama(prompt);
      const citations = sources.map(s => s.url);

      const processingTime = Date.now() - startTime;
      console.log(`[Ask] Request completed in ${processingTime}ms`);

      res.json({ 
        answer: summary.trim(), 
        citations,
        queryInfo,
        processingTime,
      });
    }

  } catch (err) {
    console.error('[Ask] Error:', err);
    
    const errorMessage = err.message || 'Something went wrong';
    
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ 
        error: errorMessage,
        details: config.nodeEnv === 'development' ? err.stack : undefined,
      });
    }
  }
});

/**
 * Clear context route
 */
router.post('/clear-context', async (req, res) => {
  try {
    clearContext();
    queryAnalyzer.clearContext();
    console.log('[Ask] All contexts cleared');
    res.json({ success: true, message: 'Context cleared' });
  } catch (error) {
    console.error('[Ask] Clear context error:', error);
    res.status(500).json({ error: 'Failed to clear context' });
  }
});

/**
 * Streaming endpoint using Server-Sent Events (GET)
 */
router.get('/stream', async (req, res) => {
  const question = req.query.question;

  if (!question || question.length < 3) {
    return res.status(400).json({ error: 'Invalid question.' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const startTime = Date.now();

  try {
    // Step 1: Analyze query
    console.log(`\n[Ask Stream] New question: "${question}"`);
    const queryInfo = await queryAnalyzer.processQuery(question);
    const searchQuery = queryInfo.processed;

    // Step 2: Search
    const searchResults = await searchSearxng(searchQuery);
    if (!searchResults || searchResults.length === 0) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error',
        error: "No sources found"
      })}\n\n`);
      return res.end();
    }

    // Step 3: Prepare sources
    const sources = await prepareSourcesForRAG(searchResults, searchQuery);
    if (!sources.length) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error',
        error: "Couldn't extract content from sources"
      })}\n\n`);
      return res.end();
    }

    // Send metadata (sources and query info)
    res.write(`event: metadata\ndata: ${JSON.stringify({ 
      type: 'metadata',
      sources: sources.map(s => ({ title: s.title, url: s.url })),
      queryInfo,
    })}\n\n`);

    // Step 4: Format sources for RAG
    const formattedSources = sources.map((src, i) =>
      `[${i + 1}]\nTitle: ${src.title}\nSource: ${src.url}\n\n${src.content}`
    ).join('\n\n');

    const prompt = prompts.answerGeneration(question, formattedSources);

    // Step 5: Stream LLM response
    let fullAnswer = '';
    
    await queryOllama(prompt, {
      stream: true,
      useCache: false,
      onToken: (token) => {
        fullAnswer += token;
        res.write(`event: token\ndata: ${JSON.stringify({ 
          type: 'token',
          content: token
        })}\n\n`);
      },
    });

    // Send completion
    res.write(`event: done\ndata: ${JSON.stringify({ 
      type: 'done',
      answer: fullAnswer.trim(),
      citations: sources.map(s => s.url),
      queryInfo,
      processingTime: Date.now() - startTime,
    })}\n\n`);

    res.end();

  } catch (err) {
    console.error('[Ask Stream] Error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ 
      type: 'error',
      error: err.message || 'Something went wrong'
    })}\n\n`);
    res.end();
  }
});

/**
 * Get context info (for debugging)
 */
router.get('/context-info', (req, res) => {
  const queryContext = queryAnalyzer.getContextSummary();
  res.json({
    queryAnalyzer: queryContext,
  });
});

module.exports = router;
