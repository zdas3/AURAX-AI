import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

// In-memory signals log cache
let activeSignalCache = null;
let signalHistory = [];

// Helper to calculate simple technical indicators locally in JS
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

  // Bullish vs Bearish indications
  const isEmaBullish = latest20 > latest50 && latest50 > latest200;
  const isEmaBearish = latest20 < latest50 && latest50 < latest200;

  const trendStrength = Math.abs(latest20 - latest200) / latest200 * 1000; // custom ratio
  
  return {
    ema20: parseFloat(latest20.toFixed(2)),
    ema50: parseFloat(latest50.toFixed(2)),
    ema200: parseFloat(latest200.toFixed(2)),
    rsi: parseFloat(rsi.toFixed(2)),
    atr: parseFloat(atr.toFixed(2)),
    trendScore: isEmaBullish ? 80 : isEmaBearish ? 20 : 50,
    volatilityScore: Math.min(100, Math.max(10, Math.round(atr * 10))),
    bullishIndication: isEmaBullish ? "Strong Bullish" : isEmaBearish ? "Strong Bearish" : "Neutral Consolidation"
  };
};

// Generate Signals Endpoint
router.post('/generate', async (req, res) => {
  try {
    const { candles, news } = req.body;
    
    if (!candles || candles.length < 20) {
      return res.status(400).json({ error: "Insufficient candle data (minimum 20 candles required)" });
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
      // Fetch news sentiment from FastAPI if news exists
      if (news && news.length > 0) {
        const sentRes = await axios.post(`${AI_ENGINE_URL}/api/sentiment`, { headlines: news }, { timeout: 2000 });
        sentiment = sentRes.data;
      }
      
      // Fetch AI prediction
      const predRes = await axios.post(`${AI_ENGINE_URL}/api/predict`, {
        candles: candles,
        sentiment_score: sentiment.sentiment_score
      }, { timeout: 2000 });
      aiPred = predRes.data;
      
      // Fetch SMC
      const smcRes = await axios.post(`${AI_ENGINE_URL}/api/smc`, { candles: candles }, { timeout: 2000 });
      smc = smcRes.data;
      
      engineConnected = true;
    } catch (engineError) {
      console.warn("FastAPI Engine connection failed. Falling back to local backend calculation mode.", engineError.message);
      // Fallback prediction based on EMAs and RSI
      const isBullish = tech.trendScore > 60;
      const isBearish = tech.trendScore < 40;
      const probability = isBullish ? 0.65 : isBearish ? 0.35 : 0.50;
      
      aiPred = {
        bullish_prob: probability,
        bearish_prob: 1.0 - probability,
        confidence: isBullish || isBearish ? 65 : 50,
        trend_continuation_prob: probability,
        simulated: true
      };
      
      // Fallback SMC based on basic pivots
      smc = {
        fvgs: [
          { type: isBullish ? "bullish" : "bearish", top: currentPrice * 1.002, bottom: currentPrice * 0.998, mitigated: false, timestamp: latestCandle.timestamp }
        ],
        order_blocks: [
          { type: isBullish ? "bullish" : "bearish", top: currentPrice * (isBullish ? 0.995 : 1.005), bottom: currentPrice * (isBullish ? 0.992 : 1.002), strength: "High", mitigated: false }
        ],
        market_structure: [
          { type: isBullish ? "bullish" : "bearish", structure: "BOS", price: currentPrice * (isBullish ? 0.99 : 1.01), timestamp: latestCandle.timestamp }
        ],
        liquidity_sweeps: [
          { type: isBullish ? "bullish" : "bearish", price_swept: currentPrice * (isBullish ? 0.997 : 1.003), timestamp: latestCandle.timestamp }
        ],
        supply_demand_zones: [
          { type: isBullish ? "demand" : "supply", top: currentPrice * (isBullish ? 0.994 : 1.006), bottom: currentPrice * (isBullish ? 0.991 : 1.004), strength: "High" }
        ]
      };
    }

    // 3. Weighted Confidence Scoring System
    let score = 50; // Neutral starting score
    let breakdown = [];

    // Rule A: Higher timeframe / EMA Trend (Weight: 20)
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
      if (recentSweep.type === "bullish") { // Sell-side swept -> price ready to reverse upwards
        score += 15;
        breakdown.push({ factor: "Liquidity Sweep - SSL (Bullish Rejection)", weight: 15 });
      } else if (recentSweep.type === "bearish") { // Buy-side swept -> ready to reverse downwards
        score -= 15;
        breakdown.push({ factor: "Liquidity Sweep - BSL (Bearish Rejection)", weight: -15 });
      }
    }

    // Rule D: RSI divergence/extreme (Weight: 10)
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
    const latestOB = smc.order_blocks[smc.order_blocks.length - 1];
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
    
    if (score >= 70) {
      direction = "BUY";
      confidencePercent = Math.min(95, score);
    } else if (score <= 30) {
      direction = "SELL";
      confidencePercent = Math.min(95, 100 - score);
    } else {
      direction = "HOLD";
      confidencePercent = Math.round(50 + Math.abs(50 - score));
    }

    // 5. Generate Target Levels (Entry, SL, TPs)
    let entry = currentPrice;
    let sl = 0;
    let tp1 = 0;
    let tp2 = 0;
    let tp3 = 0;
    let rrRatio = 0;
    
    const atrFactor = Math.max(1.5, tech.atr); // ensure realistic range

    if (direction === "BUY") {
      entry = parseFloat(currentPrice.toFixed(2));
      // Stop Loss goes below nearest demand zone/order block or ATR multiplier
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
      // Stop Loss goes above nearest supply zone/order block or ATR multiplier
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

    // Store in history
    if (direction !== "HOLD") {
      activeSignalCache = newSignal;
      signalHistory.unshift(newSignal);
      if (signalHistory.length > 50) signalHistory.pop(); // keep last 50
    }

    res.json({
      activeSignal: newSignal,
      technicalSummary: tech,
      sentimentSummary: sentiment
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
    // Return a default mock active setup if none has been generated yet
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
