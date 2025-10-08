const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const cache = require('./utils/cache');
const askRoute = require('./routes/ask');
const relatedRoute = require('./routes/related');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/ask', askRoute);
app.use('/related', relatedRoute);

// Cache stats endpoint
app.get('/api/cache-stats', (req, res) => {
  res.json(cache.getStats());
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    config: {
      searxng: config.searxng.url,
      ollama: config.ollama.url,
      model: config.ollama.model,
      features: config.features,
    },
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(config.port, () => {
  console.log('\n=================================');
  console.log(` Atlas Server Running`);
  console.log(`=================================`);
  console.log(`URL: http://localhost:${config.port}`);
  console.log(`SearXNG: ${config.searxng.url}`);
  console.log(`Ollama: ${config.ollama.url} (${config.ollama.model})`);
  console.log('=================================\n');
});
