import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { calculateTechnicalIndicators, calculateSessionProfiles, calculateSMCLevels } from '../utils/indicators.js';
import { getMarketState } from '../marketEngine.js';

dotenv.config();
const router = express.Router();

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

// In-memory signals log cache
let activeSignalCache = null;
let signalHistory = [];

// Helper to get or generate candles relative to the current live price
const getCandlesHelper = (req, timeframe = '15m', limit = 60) => {
  const priceCache = req.app.locals.priceCache || { price: 4335.50, timestamp: Date.now() };
  const candlesCache = req.app.locals.candlesCache || {};
  const cacheKey = `${timeframe}_${limit}`;
  const cachedData = candlesCache[cacheKey];
  
  const currentPrice = priceCache.price;
  
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

  const now = Date.now();
  if (cachedData) {
    const elapsed = now - cachedData.timestamp;
    if (elapsed < 60000) {
      return returnUpdatedCandles(cachedData.data);
    }
    
    // Slide window: generate matching newer candles for elapsed time
    const candles = [...cachedData.data];
    const intervals = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1H': 3600000,
      '4H': 14400000,
      'Daily': 86400000
    };
    const intervalMs = intervals[timeframe] || 900000;
    
    // Only slide if at least one interval has passed
    const passedIntervals = Math.floor(elapsed / intervalMs);
    if (passedIntervals > 0) {
      for (let s = 0; s < Math.min(passedIntervals, candles.length); s++) {
        candles.shift();
        const lastCandle = candles[candles.length - 1];
        const lastClose = lastCandle ? lastCandle.close : currentPrice;
        
        const open = lastClose;
        const close = open + (Math.random() - 0.49) * 3;
        const high = Math.max(open, close) + Math.random() * 1.5;
        const low = Math.min(open, close) - Math.random() * 1.5;
        const volume = Math.floor(1000 + Math.random() * 4000);
        
        const candleTime = new Date(cachedData.timestamp + (s + 1) * intervalMs);
        
        candles.push({
          timestamp: candleTime.toISOString(),
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: volume
        });
      }
      candlesCache[cacheKey] = { data: candles, timestamp: now };
    }
    return returnUpdatedCandles(candles);
  }
  
  // Fallback: Generate mock candles
  const generateMockCandlesLocal = (count, basePrice) => {
    const candles = [];
    let currentPrice = basePrice;
    let now = Date.now();
    for (let i = 0; i < count; i++) {
      const time = new Date(now - (count - i) * 15 * 60 * 1000);
      const open = currentPrice + (Math.random() - 0.5) * 3;
      const close = open + (Math.random() - 0.49) * 4;
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
  
  const mockCandles = generateMockCandlesLocal(limit, currentPrice);
  candlesCache[cacheKey] = { data: mockCandles, timestamp: Date.now() };
  return returnUpdatedCandles(mockCandles);
};

// Utilities imported from indicators.js

// Generate Signals Endpoint (Serves centralized market state)
router.all('/generate', (req, res) => {
  const state = getMarketState();
  res.json({
    activeSignal: state.activeSignal,
    technicalSummary: state.technicalSummary,
    sentimentSummary: state.sentimentSummary,
    sessionProfiles: state.sessionProfiles
  });
});

// Get Signal History
router.get('/history', (req, res) => {
  res.json(getMarketState().signalHistory);
});

// Get Latest Active Signal
router.get('/active', (req, res) => {
  res.json(getMarketState().activeSignal);
});

export default router;
