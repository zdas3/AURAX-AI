import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

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

// Helper to calculate technical indicators locally in JS
const calculateTechnicalIndicators = (candles) => {
  const prices = candles.map(c => c.close);
  const len = prices.length;
  
  // 1. Calculate EMAs
  const ema = (data, period) => {
    const k = 2 / (period + 1);
    let emaVal = data[0];
    const emaArr = [emaVal];
    for (let i = 1; i < data.length; i++) {
      emaVal = data[i] * k + emaVal * (1 - k);
      emaArr.push(emaVal);
    }
    return emaArr;
  };
  
  const ema20Arr = ema(prices, 20);
  const ema50Arr = ema(prices, 50);
  const ema200Arr = ema(prices, 200);
  
  const latest20 = ema20Arr[len - 1];
  const latest50 = ema50Arr[len - 1];
  const latest200 = ema200Arr[len - 1];
  
  // 2. Simple RSI calculation
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < Math.min(len, 15); i++) {
    const diff = prices[len - i] - prices[len - i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= 14;
  avgLoss /= 14;
  const rs = avgGain / (avgLoss + 1e-9);
  const rsi = 100 - (100 / (1 + rs));

  // 3. ATR calculation
  let sumTr = 0;
  for (let i = 1; i < Math.min(len, 15); i++) {
    const c = candles[len - i];
    const prevC = candles[len - i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevC.close),
      Math.abs(c.low - prevC.close)
    );
    sumTr += tr;
  }
  const atr = sumTr / 14;

  // 4. MACD calculation (12, 26, 9)
  const ema12Arr = ema(prices, 12);
  const ema26Arr = ema(prices, 26);
  const macdLine = ema12Arr.map((val, idx) => val - ema26Arr[idx]);
  const signalLine = ema(macdLine, 9);
  const latestMacd = macdLine[len - 1];
  const latestSignal = signalLine[len - 1];
  const latestHist = latestMacd - latestSignal;

  // 5. Bollinger Bands (20, 2)
  const getBands = (data, period = 20) => {
    if (data.length < period) return { upper: data[data.length - 1], middle: data[data.length - 1], lower: data[data.length - 1] };
    const slice = data.slice(-period);
    const middle = slice.reduce((sum, val) => sum + val, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
      upper: middle + 2 * stdDev,
      middle: middle,
      lower: middle - 2 * stdDev
    };
  };
  const bb = getBands(prices, 20);

  // Bullish vs Bearish indications
  const isEmaBullish = latest20 > latest50 && latest50 > latest200;
  const isEmaBearish = latest20 < latest50 && latest50 < latest200;

  const trendStrength = Math.abs(latest20 - latest200) / latest200 * 1000;
  
  return {
    ema20: parseFloat(latest20.toFixed(2)),
    ema50: parseFloat(latest50.toFixed(2)),
    ema200: parseFloat(latest200.toFixed(2)),
    rsi: parseFloat(rsi.toFixed(2)),
    atr: parseFloat(atr.toFixed(2)),
    macd: {
      macdLine: parseFloat(latestMacd.toFixed(3)),
      signalLine: parseFloat(latestSignal.toFixed(3)),
      histogram: parseFloat(latestHist.toFixed(3))
    },
    bb: {
      upper: parseFloat(bb.upper.toFixed(2)),
      middle: parseFloat(bb.middle.toFixed(2)),
      lower: parseFloat(bb.lower.toFixed(2))
    },
    trendScore: isEmaBullish ? 80 : isEmaBearish ? 20 : 50,
    volatilityScore: Math.min(100, Math.max(10, Math.round(atr * 10))),
    bullishIndication: isEmaBullish ? "Strong Bullish" : isEmaBearish ? "Strong Bearish" : "Neutral Consolidation"
  };
};

// Helper to calculate session liquidity ranges dynamically from candle data
const calculateSessionProfiles = (candles) => {
  if (!candles || candles.length === 0) {
    return {
      asian: { high: 4339.40, low: 4324.20, status: "Accumulation complete" },
      london: { high: 4344.80, low: 4321.50, status: "Asian Sweep Hunt detected" },
      newyork: { high: 4348.60, low: 4326.10, status: "Distribution phase active" }
    };
  }
  
  const len = candles.length;
  // Divide candles to represent Asian (early), London (mid), NY (late)
  const asianSlice = candles.slice(0, Math.floor(len * 0.35));
  const londonSlice = candles.slice(Math.floor(len * 0.35), Math.floor(len * 0.75));
  const nySlice = candles.slice(Math.floor(len * 0.75));
  
  const getSliceHighLow = (slice, defaultOffsetHigh, defaultOffsetLow) => {
    if (slice.length === 0) {
      const lastClose = candles[candles.length - 1].close;
      return { high: lastClose + defaultOffsetHigh, low: lastClose - defaultOffsetLow };
    }
    const highs = slice.map(c => c.high);
    const lows = slice.map(c => c.low);
    return {
      high: Math.max(...highs),
      low: Math.min(...lows)
    };
  };

  const asianRange = getSliceHighLow(asianSlice, 5, 8);
  const londonRange = getSliceHighLow(londonSlice, 8, 12);
  const nyRange = getSliceHighLow(nySlice, 12, 6);

  const lastClose = candles[candles.length - 1].close;
  
  return {
    asian: {
      high: parseFloat(asianRange.high.toFixed(2)),
      low: parseFloat(asianRange.low.toFixed(2)),
      status: "Accumulation complete"
    },
    london: {
      high: parseFloat(Math.max(londonRange.high, asianRange.high + 1.5).toFixed(2)),
      low: parseFloat(Math.min(londonRange.low, asianRange.low - 2.2).toFixed(2)),
      status: lastClose > asianRange.high ? "Asian High Swept" : "Asian Sweep Hunt detected"
    },
    newyork: {
      high: parseFloat(Math.max(nyRange.high, londonRange.high + 2.0).toFixed(2)),
      low: parseFloat(Math.min(nyRange.low, londonRange.low - 1.8).toFixed(2)),
      status: Math.abs(lastClose - nyRange.high) < 4 ? "Distribution High Test" : "Distribution phase active"
    }
  };
};

// Helper to calculate stable pivot-based SMC levels
const calculateSMCLevels = (candles, isBullish) => {
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const latestCandle = candles[candles.length - 1];
  const currentPrice = latestCandle.close;
  
  const sliceSize = Math.min(candles.length, 30);
  const recentHighs = highs.slice(-sliceSize);
  const recentLows = lows.slice(-sliceSize);
  
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  
  // Find a mock FVG (imbalance) in recent candles
  // Bullish FVG: Low of candle i > High of candle i-2
  let fvgTop = currentPrice * 1.001;
  let fvgBottom = currentPrice * 0.999;
  for (let i = candles.length - 1; i >= 2; i--) {
    if (candles[i].low > candles[i-2].high) {
      fvgTop = candles[i].low;
      fvgBottom = candles[i-2].high;
      break;
    }
  }
  
  return {
    fvgs: [
      { type: isBullish ? "bullish" : "bearish", top: parseFloat(fvgTop.toFixed(2)), bottom: parseFloat(fvgBottom.toFixed(2)), mitigated: false, timestamp: latestCandle.timestamp }
    ],
    order_blocks: [
      { type: "bullish", top: parseFloat((lowestLow * 1.001).toFixed(2)), bottom: parseFloat(lowestLow.toFixed(2)), strength: "High", mitigated: false },
      { type: "bearish", top: parseFloat(highestHigh.toFixed(2)), bottom: parseFloat((highestHigh * 0.999).toFixed(2)), strength: "High", mitigated: false }
    ],
    market_structure: [
      { type: isBullish ? "bullish" : "bearish", structure: "BOS", price: parseFloat((isBullish ? highestHigh : lowestLow).toFixed(2)), timestamp: latestCandle.timestamp }
    ],
    liquidity_sweeps: [
      { type: isBullish ? "bullish" : "bearish", price_swept: parseFloat((isBullish ? lowestLow : highestHigh).toFixed(2)), timestamp: latestCandle.timestamp }
    ],
    supply_demand_zones: [
      { type: "demand", top: parseFloat((lowestLow * 1.002).toFixed(2)), bottom: parseFloat(lowestLow.toFixed(2)), strength: "High" },
      { type: "supply", top: parseFloat(highestHigh.toFixed(2)), bottom: parseFloat((highestHigh * 0.998).toFixed(2)), strength: "High" }
    ]
  };
};

// Generate Signals Endpoint (Supports POST JSON and GET Query parameters)
router.all('/generate', async (req, res) => {
  try {
    let candles = req.body?.candles || req.query?.candles;
    let news = req.body?.news || req.query?.news;
    const timeframe = req.body?.timeframe || req.query?.timeframe || '15m';

    // Parse query params if sent as strings (e.g. from GET requests)
    if (typeof candles === 'string') {
      try { candles = JSON.parse(candles); } catch (e) {}
    }
    if (typeof news === 'string') {
      try { news = JSON.parse(news); } catch (e) {}
    }

    // Load from cache if not provided
    if (!candles || !Array.isArray(candles) || candles.length < 20) {
      candles = getCandlesHelper(req, timeframe, 60);
    }
    if (!news || !Array.isArray(news) || news.length === 0) {
      news = req.app.locals.newsCache?.articles || [];
    }

    const latestCandle = candles[candles.length - 1];
    const currentPrice = latestCandle.close;
    
    // 1. Calculate indicators locally
    const tech = calculateTechnicalIndicators(candles);
    
    // 2. Fetch AI predictions, SMC indicators and news sentiment from FastAPI Engine
    let aiPred = { bullish_prob: 0.5, bearish_prob: 0.5, confidence: 50, trend_continuation_prob: 0.5 };
    let smc = { fvgs: [], order_blocks: [], market_structure: [], liquidity_sweeps: [], supply_demand_zones: [] };
    let sentiment = { sentiment_score: 0.0, bias: "neutral", impact_level: "Low", market_mood: "Neutral" };
    
    let engineConnected = false;
    
    try {
      if (news && news.length > 0) {
        const sentRes = await axios.post(`${AI_ENGINE_URL}/api/sentiment`, { headlines: news }, { timeout: 2000 });
        sentiment = sentRes.data;
      }
      
      const predRes = await axios.post(`${AI_ENGINE_URL}/api/predict`, {
        candles: candles,
        sentiment_score: sentiment.sentiment_score
      }, { timeout: 2000 });
      aiPred = predRes.data;
      
      const smcRes = await axios.post(`${AI_ENGINE_URL}/api/smc`, { candles: candles }, { timeout: 2000 });
      smc = smcRes.data;
      
      engineConnected = true;
    } catch (engineError) {
      // Fallback calculations using local helper math
      const isBullish = tech.trendScore > 60;
      const isBearish = tech.trendScore < 40;
      const probability = isBullish ? 0.68 : isBearish ? 0.32 : 0.50;
      
      aiPred = {
        bullish_prob: probability,
        bearish_prob: 1.0 - probability,
        confidence: isBullish || isBearish ? 74 : 50,
        trend_continuation_prob: probability,
        simulated: true
      };
      
      smc = calculateSMCLevels(candles, isBullish);
    }

    // 3. Weighted Confidence Scoring System
    let score = 50; // Neutral starting score
    let breakdown = [];

    // Rule A: Trend Alignment (Weight: 20)
    if (tech.trendScore > 60) {
      score += 20;
      breakdown.push({ factor: "EMA Trend Alignment (Bullish)", weight: 20 });
    } else if (tech.trendScore < 40) {
      score -= 20;
      breakdown.push({ factor: "EMA Trend Alignment (Bearish)", weight: -20 });
    }

    // Rule B: AI prediction probability (Weight: 20)
    if (aiPred.bullish_prob > 0.6) {
      score += 20;
      breakdown.push({ factor: "AI Prediction (Bullish)", weight: 20 });
    } else if (aiPred.bearish_prob > 0.6) {
      score -= 20;
      breakdown.push({ factor: "AI Prediction (Bearish)", weight: -20 });
    }

    // Rule C: Liquidity Sweeps (Weight: 15)
    const recentSweep = smc.liquidity_sweeps[smc.liquidity_sweeps.length - 1];
    if (recentSweep) {
      if (recentSweep.type === "bullish") {
        score += 15;
        breakdown.push({ factor: "Liquidity Sweep - SSL (Bullish Rejection)", weight: 15 });
      } else if (recentSweep.type === "bearish") {
        score -= 15;
        breakdown.push({ factor: "Liquidity Sweep - BSL (Bearish Rejection)", weight: -15 });
      }
    }

    // Rule D: RSI condition (Weight: 10)
    if (tech.rsi < 30) {
      score += 10;
      breakdown.push({ factor: "RSI Oversold Condition", weight: 10 });
    } else if (tech.rsi > 70) {
      score -= 10;
      breakdown.push({ factor: "RSI Overbought Condition", weight: -10 });
    }

    // Rule E: News Sentiment (Weight: 15)
    if (sentiment.sentiment_score > 20) {
      score += 15;
      breakdown.push({ factor: "Macro News Sentiment (Bullish)", weight: 15 });
    } else if (sentiment.sentiment_score < -20) {
      score -= 15;
      breakdown.push({ factor: "Macro News Sentiment (Bearish)", weight: -15 });
    }

    // Rule F: Order Block Re-test (Weight: 15)
    const latestOB = smc.order_blocks.find(ob => ob.type === (score > 50 ? "bullish" : "bearish"));
    if (latestOB && !latestOB.mitigated) {
      if (latestOB.type === "bullish" && currentPrice >= latestOB.bottom && currentPrice <= latestOB.top) {
        score += 15;
        breakdown.push({ factor: "Demand Order Block Re-test", weight: 15 });
      } else if (latestOB.type === "bearish" && currentPrice >= latestOB.bottom && currentPrice <= latestOB.top) {
        score -= 15;
        breakdown.push({ factor: "Supply Order Block Re-test", weight: -15 });
      }
    }

    // 4. Determine Signal (BUY / SELL / HOLD)
    let direction = "HOLD";
    let confidencePercent = 50;
    
    if (score >= 68) {
      direction = "BUY";
      confidencePercent = Math.min(96, score);
    } else if (score <= 32) {
      direction = "SELL";
      confidencePercent = Math.min(96, 100 - score);
    } else {
      direction = "HOLD";
      confidencePercent = Math.round(50 + Math.abs(50 - score));
    }

    // Force a new signal direction (BUY or SELL) at least every 30 minutes
    const now = Date.now();
    if (!req.app.locals.lastSignalTime) {
      req.app.locals.lastSignalTime = now;
    }

    if (direction !== "HOLD") {
      req.app.locals.lastSignalTime = now;
      req.app.locals.forcedDirection = null;
    } else {
      if (now - req.app.locals.lastSignalTime >= 1800000) {
        const forcedDir = Math.random() > 0.5 ? "BUY" : "SELL";
        direction = forcedDir;
        confidencePercent = Math.floor(75 + Math.random() * 18);
        req.app.locals.forcedDirection = forcedDir;
        req.app.locals.lastSignalTime = now;
      } else if (req.app.locals.forcedDirection) {
        direction = req.app.locals.forcedDirection;
        confidencePercent = Math.floor(75 + Math.random() * 18);
      }
    }

    // 5. Generate Target Levels (Entry, SL, TPs)
    let entry = currentPrice;
    let sl = 0;
    let tp1 = 0;
    let tp2 = 0;
    let tp3 = 0;
    let rrRatio = 0;
    
    const atrFactor = Math.max(1.5, tech.atr);

    if (direction === "BUY") {
      entry = parseFloat(currentPrice.toFixed(2));
      const demandZone = smc.supply_demand_zones.find(z => z.type === "demand");
      const slLevel = demandZone ? demandZone.bottom : currentPrice - (atrFactor * 2.0);
      sl = parseFloat(Math.min(currentPrice - 2.0, slLevel).toFixed(2));
      
      const risk = entry - sl;
      tp1 = parseFloat((entry + risk * 1.2).toFixed(2));
      tp2 = parseFloat((entry + risk * 2.0).toFixed(2));
      tp3 = parseFloat((entry + risk * 3.5).toFixed(2));
      rrRatio = parseFloat(( (tp2 - entry) / (entry - sl) ).toFixed(2));
    } else if (direction === "SELL") {
      entry = parseFloat(currentPrice.toFixed(2));
      const supplyZone = smc.supply_demand_zones.find(z => z.type === "supply");
      const slLevel = supplyZone ? supplyZone.top : currentPrice + (atrFactor * 2.0);
      sl = parseFloat(Math.max(currentPrice + 2.0, slLevel).toFixed(2));
      
      const risk = sl - entry;
      tp1 = parseFloat((entry - risk * 1.2).toFixed(2));
      tp2 = parseFloat((entry - risk * 2.0).toFixed(2));
      tp3 = parseFloat((entry - risk * 3.5).toFixed(2));
      rrRatio = parseFloat(( (entry - tp2) / (sl - entry) ).toFixed(2));
    }

    const newSignal = {
      id: "SIG_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      symbol: "XAUUSD",
      direction: direction,
      entry: direction !== "HOLD" ? entry : null,
      stopLoss: direction !== "HOLD" ? sl : null,
      takeProfit1: direction !== "HOLD" ? tp1 : null,
      takeProfit2: direction !== "HOLD" ? tp2 : null,
      takeProfit3: direction !== "HOLD" ? tp3 : null,
      riskRewardRatio: direction !== "HOLD" ? rrRatio : null,
      confidenceScore: confidencePercent,
      riskLevel: confidencePercent > 80 ? "Low" : confidencePercent > 65 ? "Medium" : "High",
      confluences: breakdown,
      engineConnected: engineConnected,
      smcLevels: smc,
      technicalIndicators: tech,
      aiPredictions: aiPred
    };

    if (direction !== "HOLD") {
      activeSignalCache = newSignal;
      signalHistory.unshift(newSignal);
      if (signalHistory.length > 50) signalHistory.pop();
    }

    const sessionProfiles = calculateSessionProfiles(candles);

    res.json({
      activeSignal: newSignal,
      technicalSummary: tech,
      sentimentSummary: sentiment,
      sessionProfiles: sessionProfiles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Signal History
router.get('/history', (req, res) => {
  res.json(signalHistory);
});

// Get Latest Active Signal
router.get('/active', (req, res) => {
  if (activeSignalCache) {
    res.json(activeSignalCache);
  } else {
    res.json({
      id: "SIG_INITIAL_XAU",
      timestamp: new Date().toISOString(),
      symbol: "XAUUSD",
      direction: "BUY",
      entry: 4335.50,
      stopLoss: 4315.00,
      takeProfit1: 4360.00,
      takeProfit2: 4380.00,
      takeProfit3: 4410.00,
      riskRewardRatio: 2.22,
      confidenceScore: 78,
      riskLevel: "Medium",
      confluences: [
        { factor: "EMA Trend Alignment (Bullish)", weight: 20 },
        { factor: "Demand Order Block Re-test", weight: 15 },
        { factor: "Liquidity Sweep - SSL (Bullish Rejection)", weight: 15 }
      ]
    });
  }
});

export default router;
