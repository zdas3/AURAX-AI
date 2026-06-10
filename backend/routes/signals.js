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

    // Check if we can reuse the existing cached signal (locked for 30 minutes)
    const nowMs = Date.now();
    let lockedSignal = null;
    if (activeSignalCache) {
      const elapsed = nowMs - new Date(activeSignalCache.timestamp).getTime();
      if (elapsed < 1800000) { // 30 minutes in milliseconds
        lockedSignal = activeSignalCache;
      }
    }

    let newSignal = null;

    if (lockedSignal) {
      newSignal = lockedSignal;
    } else {
      // Calculate Multi-Timeframe Technical Indicators
      const dailyCandles = getCandlesHelper(req, 'Daily', 40);
      const h4Candles = getCandlesHelper(req, '4H', 40);
      const h1Candles = getCandlesHelper(req, '1H', 40);
      const m15Candles = getCandlesHelper(req, '15m', 40);
      const m5Candles = getCandlesHelper(req, '5m', 40);

      const dailyTech = calculateTechnicalIndicators(dailyCandles);
      const h4Tech = calculateTechnicalIndicators(h4Candles);
      const h1Tech = calculateTechnicalIndicators(h1Candles);
      const m15Tech = calculateTechnicalIndicators(m15Candles);
      const m5Tech = calculateTechnicalIndicators(m5Candles);

      // 3. Multi-Disciplinary Confluence Scoring Engine (Technical, Fundamental, SMC & Correlation Analysis)
      let finalScore = 50; // Neutral starting score
      let confluences = [];

      // A. Multi-Timeframe Trend Filter (+20)
      const dailyBullish = dailyTech.trendScore >= 50;
      const h4Bullish = h4Tech.trendScore >= 50;
      const h1Bullish = h1Tech.trendScore >= 50;
      const m15Bullish = m15Tech.trendScore >= 50;
      
      const macroAligns = (dailyBullish === h4Bullish) && (h4Bullish === h1Bullish);
      const setupAligns = (m15Bullish === h1Bullish);

      if (macroAligns && setupAligns) {
        finalScore += 20;
        confluences.push({ factor: "Macro Timeframe Trend Alignment (Daily/H4/H1/15M)", weight: 20 });
      } else {
        finalScore -= 10;
        confluences.push({ factor: `Conflicting HTF Bias (Daily: ${dailyBullish ? 'BULL' : 'BEAR'} / H4: ${h4Bullish ? 'BULL' : 'BEAR'})`, weight: -10 });
      }

      // B. SMC Structural Analysis: Liquidity Sweep (+15)
      const recentSweep = smc.liquidity_sweeps[smc.liquidity_sweeps.length - 1];
      if (recentSweep) {
        if (recentSweep.type === "bullish") {
          finalScore += 15;
          confluences.push({ factor: "SMC Liquidity Sweep (SSL Reclaimed)", weight: 15 });
        } else if (recentSweep.type === "bearish") {
          finalScore -= 15;
          confluences.push({ factor: "SMC Liquidity Sweep (BSL Rejected)", weight: -15 });
        }
      }

      // C. SMC Structural Analysis: Order Blocks (+15)
      const latestOB = smc.order_blocks.find(ob => !ob.mitigated);
      if (latestOB) {
        if (latestOB.type === "bullish" && currentPrice >= latestOB.bottom && currentPrice <= latestOB.top) {
          finalScore += 15;
          confluences.push({ factor: "Demand Order Block Re-test (Bullish)", weight: 15 });
        } else if (latestOB.type === "bearish" && currentPrice >= latestOB.bottom && currentPrice <= latestOB.top) {
          finalScore -= 15;
          confluences.push({ factor: "Supply Order Block Re-test (Bearish)", weight: -15 });
        }
      }

      // D. AI prediction probabilities (+20)
      if (aiPred.bullish_prob > 0.8) {
        finalScore += 20;
        confluences.push({ factor: `AI Ensemble Bullish Conviction (${(aiPred.bullish_prob * 100).toFixed(0)}%)`, weight: 20 });
      } else if (aiPred.bearish_prob > 0.8) {
        finalScore -= 20;
        confluences.push({ factor: `AI Ensemble Bearish Conviction (${(aiPred.bearish_prob * 100).toFixed(0)}%)`, weight: -20 });
      }

      // E. News & Macro Sentiment Filter (+10)
      if (sentiment.sentiment_score > 25) {
        finalScore += 10;
        confluences.push({ factor: "Macro News Sentiment (Bullish Bias)", weight: 10 });
      } else if (sentiment.sentiment_score < -25) {
        finalScore -= 10;
        confluences.push({ factor: "Macro News Sentiment (Bearish Bias)", weight: -10 });
      }

      // F. Technical Indicator: Volume Confirmation (+10)
      const avgVol = candles.slice(-10).reduce((sum, c) => sum + c.volume, 0) / 10;
      const volRatio = latestCandle.volume / (avgVol + 1e-9);
      if (volRatio > 1.25) {
        if (tech.trendScore >= 50) {
          finalScore += 10;
          confluences.push({ factor: "High-Volume Breakout Confirmation (Bullish)", weight: 10 });
        } else {
          finalScore -= 10;
          confluences.push({ factor: "High-Volume Breakout Confirmation (Bearish)", weight: -10 });
        }
      }

      // G. Macro Correlation Filter (+10)
      const dxyCorr = req.app.locals.correlationCache?.data?.correlations?.DXY || -0.83;
      if (dxyCorr < -0.75) {
        if (tech.trendScore >= 50) {
          finalScore += 10;
          confluences.push({ factor: "DXY Macro Correlation (Risk-Off Gold Bid)", weight: 10 });
        } else {
          finalScore -= 10;
          confluences.push({ factor: "DXY Macro Correlation (Risk-On Gold Outflow)", weight: -10 });
        }
      }

      // H. Volatility / News Safety Locks & retail indicator filters
      if (tech.volatilityScore > 80 || Math.abs(sentiment.sentiment_score) > 60) {
        finalScore = 50 + (finalScore - 50) * 0.2;
        confluences.push({ factor: "High Impact News Volatility Safety Filter (Restricted)", weight: 0 });
      }

      const atrFactor = Math.max(1.2, tech.atr);
      if (atrFactor < 1.8) {
        finalScore = 50 + (finalScore - 50) * 0.4;
        confluences.push({ factor: "Low Volatility Consolidation Filter (Restricted)", weight: 0 });
      }

      if (tech.rsi > 75 && finalScore >= 75) {
        finalScore = 60;
        confluences.push({ factor: "RSI Extremely Overbought Filter (Locked BUY)", weight: -10 });
      }
      if (tech.rsi < 25 && finalScore <= 25) {
        finalScore = 40;
        confluences.push({ factor: "RSI Extremely Oversold Filter (Locked SELL)", weight: 10 });
      }

      // 4. Determine Signal (BUY / SELL / HOLD / NO TRADE)
      let direction = "HOLD";
      let confidencePercent = 50;
      let riskLevel = "Medium";

      if (finalScore >= 75) {
        direction = "BUY";
        confidencePercent = Math.round(finalScore);
        riskLevel = finalScore >= 90 ? "Low" : "Medium";
      } else if (finalScore <= 25) {
        direction = "SELL";
        confidencePercent = Math.round(100 - finalScore);
        riskLevel = finalScore <= 10 ? "Low" : "Medium";
      } else {
        direction = finalScore >= 60 ? "HOLD" : "NO TRADE";
        confidencePercent = Math.round(50 + Math.abs(50 - finalScore));
        riskLevel = "High";
      }

      // 5. Generate Target Levels (Entry, SL, TPs)
      let entry = currentPrice;
      let sl = 0;
      let tp1 = 0;
      let tp2 = 0;
      let tp3 = 0;
      let rrRatio = 0;

      if (direction === "BUY") {
        entry = parseFloat(currentPrice.toFixed(2));
        const demandZone = smc.supply_demand_zones.find(z => z.type === "demand");
        const slLevel = demandZone ? demandZone.bottom : currentPrice - (atrFactor * 1.5);
        sl = parseFloat(Math.min(currentPrice - 1.5, slLevel).toFixed(2));
        
        tp1 = parseFloat((entry + atrFactor * 1.0).toFixed(2));
        tp2 = parseFloat((entry + atrFactor * 2.0).toFixed(2));
        tp3 = parseFloat((entry + atrFactor * 3.5).toFixed(2));
        rrRatio = parseFloat(( (tp2 - entry) / (entry - sl) ).toFixed(2));
      } else if (direction === "SELL") {
        entry = parseFloat(currentPrice.toFixed(2));
        const supplyZone = smc.supply_demand_zones.find(z => z.type === "supply");
        const slLevel = supplyZone ? supplyZone.top : currentPrice + (atrFactor * 1.5);
        sl = parseFloat(Math.max(currentPrice + 1.5, slLevel).toFixed(2));
        
        tp1 = parseFloat((entry - atrFactor * 1.0).toFixed(2));
        tp2 = parseFloat((entry - atrFactor * 2.0).toFixed(2));
        tp3 = parseFloat((entry - atrFactor * 3.5).toFixed(2));
        rrRatio = parseFloat(( (entry - tp2) / (sl - entry) ).toFixed(2));
      }

      newSignal = {
        id: "SIG_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        timestamp: new Date().toISOString(),
        symbol: "XAUUSD",
        direction: direction,
        entry: direction === "BUY" || direction === "SELL" ? entry : null,
        stopLoss: direction === "BUY" || direction === "SELL" ? sl : null,
        takeProfit1: direction === "BUY" || direction === "SELL" ? tp1 : null,
        takeProfit2: direction === "BUY" || direction === "SELL" ? tp2 : null,
        takeProfit3: direction === "BUY" || direction === "SELL" ? tp3 : null,
        riskRewardRatio: direction === "BUY" || direction === "SELL" ? rrRatio : null,
        confidenceScore: confidencePercent,
        riskLevel: riskLevel,
        confluences: confluences,
        engineConnected: engineConnected,
        smcLevels: smc,
        technicalIndicators: tech,
        aiPredictions: aiPred,
        timeframeAnalyses: {
          daily: dailyTech.bullishIndication,
          h4: h4Tech.bullishIndication,
          h1: h1Tech.bullishIndication,
          m15: m15Tech.bullishIndication,
          m5: m5Tech.bullishIndication
        }
      };

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
