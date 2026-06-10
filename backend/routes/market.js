import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { getMarketState, updateMarketPrice } from '../marketEngine.js';

dotenv.config();
const router = express.Router();

// Cache variables helper accessing app.locals for sharing
const getCaches = (req) => {
  if (!req.app.locals.priceCache) req.app.locals.priceCache = { price: 4335.50, timestamp: Date.now() };
  if (!req.app.locals.candlesCache) req.app.locals.candlesCache = {};
  if (!req.app.locals.newsCache) req.app.locals.newsCache = { articles: [], timestamp: 0 };
  return {
    priceCache: req.app.locals.priceCache,
    candlesCache: req.app.locals.candlesCache,
    newsCache: req.app.locals.newsCache
  };
};

let correlationCache = { data: null, timestamp: 0 };

// Helper to get environment API keys
const keys = {
  twelvedata: process.env.TWELVEDATA_API_KEY,
  alphavantage: process.env.ALPHA_VANTAGE_API_KEY,
  finnhub: process.env.FINNHUB_API_KEY,
  newsapi: process.env.NEWSAPI_KEY,
  gnews: process.env.GNEWS_API_KEY
};

// Simulation Helpers (High-Fidelity Mocks)
const generateMockCandles = (count = 100, basePrice = 4335.50) => {
  const candles = [];
  let currentPrice = basePrice;
  let now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const time = new Date(now - (count - i) * 15 * 60 * 1000); // 15m intervals
    const open = currentPrice + (Math.random() - 0.5) * 3;
    const close = open + (Math.random() - 0.49) * 4; // slight upward bias
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = 1000 + Math.random() * 4000;
    
    currentPrice = close;
    
    candles.push({
      timestamp: time.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(0))
    });
  }
  return candles;
};

const mockHeadlines = [
  { title: "FOMC minutes reveal divided stance on inflation and rate hikes", description: "Fed officials remain cautious about inflation targets but signal possible delays in rate cuts.", source: "Bloomberg" },
  { title: "Geopolitical tensions rise in Middle East, pushing Brent crude higher", description: "Gold jumps as investors seek safe-haven assets amidst escalating borders conflicts.", source: "Reuters" },
  { title: "US Dollar Index DXY slides below 103 support line", description: "Weak economic indicators and manufacturing numbers trigger a decline in USD index.", source: "Financial Times" },
  { title: "Gold prices hover near key support levels ahead of CPI reports", description: "Analysts predict high volatility for XAU/USD as inflation metrics loom.", source: "CNBC" },
  { title: "US 10-Year Treasury Yield drops to 4.12% as bond demand rises", description: "Yield curves flattened today showing market pricing in dovish federal policy.", source: "MarketWatch" }
];

// 1. Get Live Price / Set Live Price (POST triggers centralized engine)
router.get('/price', (req, res) => {
  res.json({
    price: getMarketState().price,
    timestamp: getMarketState().timestamp
  });
});

router.post('/price', (req, res) => {
  const { price } = req.body;
  if (price === undefined || isNaN(price)) {
    return res.status(400).json({ error: "Invalid price parameter" });
  }
  updateMarketPrice(parseFloat(price));
  res.json({
    success: true,
    price: getMarketState().price,
    timestamp: getMarketState().timestamp
  });
});

// 2. Get Historical Candles (Supports multi-timeframe 1m, 5m, 15m, 1h, 4h, 1d)
router.get('/candles', async (req, res) => {
  const timeframe = req.query.timeframe || '15m';
  const limit = parseInt(req.query.limit) || 100;
  
  try {
    const { candlesCache } = getCaches(req);
    const now = Date.now();
    const cacheKey = `${timeframe}_${limit}`;
    const cachedData = candlesCache[cacheKey];
    
    const currentPrice = getMarketState().price;
    
    // Inline helper to sync the final candle with the live quote price
    const returnUpdatedCandles = (candles) => {
      if (candles && candles.length > 0) {
        const updated = [...candles];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          close: currentPrice,
          high: Math.max(updated[lastIdx].high, currentPrice),
          low: Math.min(updated[lastIdx].low, currentPrice)
        };
        return updated;
      }
      return candles;
    };

    // Cache candles for 1 minute
    if (cachedData && (now - cachedData.timestamp < 60000)) {
      return res.json(returnUpdatedCandles(cachedData.data));
    }

    // Convert timeframe to Twelve Data interval format
    const intervalMap = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1H': '1h',
      '4H': '4h',
      'Daily': '1day'
    };
    
    const interval = intervalMap[timeframe] || '15min';

    try {
      const response = await axios.get(`https://api.twelvedata.com/time_series`, {
        params: {
          symbol: 'XAU/USD',
          interval: interval,
          outputsize: limit,
          apikey: keys.twelvedata
        },
        timeout: 5000
      });

      if (response.data && response.data.values) {
        const candles = response.data.values.map(val => ({
          timestamp: new Date(val.datetime).toISOString(),
          open: parseFloat(val.open),
          high: parseFloat(val.high),
          low: parseFloat(val.low),
          close: parseFloat(val.close),
          volume: parseFloat(val.volume || 1000)
        })).reverse(); // Twelve data returns newest first, we want oldest first
        
        candlesCache[cacheKey] = { data: candles, timestamp: now };
        return res.json(returnUpdatedCandles(candles));
      }
      
      throw new Error(response.data.status === 'error' ? response.data.message : 'Invalid values');
    } catch (apiError) {
      // Fallback to high-fidelity mock candles
      const mockCandles = generateMockCandles(limit, currentPrice);
      candlesCache[cacheKey] = { data: mockCandles, timestamp: now };
      return res.json(returnUpdatedCandles(mockCandles));
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get News & Sentiment Headlines
router.get('/news', (req, res) => {
  res.json(getMarketState().newsList || []);
});

// 4. Get Correlation Matrix (DXY, US10Y, SPX500, Oil)
router.get('/correlation', (req, res) => {
  res.json({
    correlations: getMarketState().correlations,
    sensitivities: {
      "DXY": "High Inverse Sensitivity",
      "US10Y": "High Negative Sensitivity (Yield competitor)",
      "SPX500": "Low Cyclical Correlation",
      "CrudeOil": "Moderate Commodity Tailwind"
    },
    timestamp: new Date(getMarketState().lastUpdateTimes.correlation).toISOString()
  });
});

// 5. Get Complete Centralized State
router.get('/state', (req, res) => {
  res.json(getMarketState());
});

export default router;
