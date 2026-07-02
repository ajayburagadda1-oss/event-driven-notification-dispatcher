const express = require('express');
const eventRoutes = require('./routes/eventRoutes');

const app = express();

app.use(express.json());

// Gracefully handle invalid JSON payloads
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

app.use('/api/v1', eventRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Final fallback error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
