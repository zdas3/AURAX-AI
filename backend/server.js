import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route handlers
import marketRouter from './routes/market.js';
import signalsRouter from './routes/signals.js';
import authRouter from './routes/auth.js';
import alertsRouter from './routes/alerts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Shared in-memory caches for real-time synchronization and API rate limit protection
app.locals.priceCache = { price: 4335.50, timestamp: Date.now() };
app.locals.candlesCache = {};
app.locals.newsCache = { articles: [], timestamp: 0 };

// Enable CORS for frontend requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON request bodies
app.use(express.json());

// Register API Routes
app.use('/api/market', marketRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/auth', authRouter);
app.use('/api/alerts', alertsRouter);

// Base healthcheck route
app.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Aurax Backend Proxy",
    env: {
      supabaseConfigured: !!process.env.SUPABASE_URL,
      twelvedataConfigured: !!process.env.TWELVEDATA_API_KEY,
      newsApiConfigured: !!process.env.NEWSAPI_KEY
    }
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`Aurax Backend Proxy running on port ${PORT}`);
});

export default app;
