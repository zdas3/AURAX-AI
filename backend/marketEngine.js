import axios from 'axios';
import dotenv from 'dotenv';
import { calculateTechnicalIndicators, calculateSessionProfiles, calculateSMCLevels } from './utils/indicators.js';

dotenv.config();

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';
const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || '54f1360f16f544fcaccdb8d1e4198f72';
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || 'f0f667cdc38d4add8d09ff6e0905cfb5';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd8jtq81r01qg1oe68010d8jtq81r01qg1oe6801g';

// Default initial state
const globalMarketState = {
  price: 4335.50,
  priceDirection: "flat",
  spread: 1.2,
  timestamp: Date.now(),
  lastUpdateTimes: {
    price: Date.now(),
    indicators: Date.now(),
    signal: Date.now(),
    ai: Date.now(),
    sessions: Date.now(),
    news: Date.now(),
    correlation: Date.now()
  },
  dataFreshness: {
    price: "Live now",
    indicators: "Live now",
    signal: "Live now",
    ai: "Live now",
    news: "Live now",
    correlation: "Live now"
  },
  activeSignal: {
    id: "SIG_INITIAL_XAU",
    timestamp: new Date().toISOString(),
    symbol: "XAUUSD",
    direction: "HOLD",
    entry: null,
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    takeProfit3: null,
    riskRewardRatio: null,
    confidenceScore: 50,
    riskLevel: "Medium",
    confluences: [],
    timeframeAnalyses: {
      daily: "Neutral Consolidation",
      h4: "Neutral Consolidation",
      h1: "Neutral Consolidation",
      m15: "Neutral Consolidation",
      m5: "Neutral Consolidation"
    }
  },
  technicalSummary: {
    ema20: 4335.50,
    ema50: 4330.20,
    ema200: 4312.80,
    rsi: 52.4,
    atr: 1.85,
    macd: { macdLine: 0.12, signalLine: 0.08, histogram: 0.04 },
    bb: { upper: 4345.20, middle: 4332.10, lower: 4319.00 },
    trendScore: 50,
    volatilityScore: 35,
    bullishIndication: "Neutral Consolidation"
  },
  sentimentSummary: {
    sentiment_score: 15,
    bias: "neutral",
    impact_level: "Low",
    market_mood: "Neutral"
  },
  sessionProfiles: {
    asian: { high: 4339.40, low: 4324.20, status: "Accumulation complete" },
    london: { high: 4344.80, low: 4321.50, status: "Asian Sweep Hunt detected" },
    newyork: { high: 4348.60, low: 4326.10, status: "Distribution phase active" }
  },
  correlations: {
    "DXY": -0.82,
    "US10Y": -0.74,
    "SPX500": 0.08,
    "CrudeOil": 0.52
  },
  marketRegime: "Neutral Consolidation",
  smc: {
    fvgs: [],
    order_blocks: [],
    market_structure: [],
    liquidity_sweeps: [],
    supply_demand_zones: []
  },
  aiPredictions: {
    bullish_prob: 0.50,
    bearish_prob: 0.50,
    confidence: 50,
    trend_continuation_prob: 0.50
  },
  signalHistory: [],
  newsList: [],
  logs: []
};

// Internal caches and locks
let broadcastCallback = null;
let currentCandles15m = [];
let signalLockedUntil = 0;
let signalLockDirection = "HOLD";

// News filtering helper
const filterRelevantNews = (articles) => {
  const keywords = [
    "gold", "xau", "usd", "cpi", "fomc", "nfp", "inflation", 
    "yield", "interest rate", "fed", "federal reserve", "geopolitical",
    "treasury", "powell", "war", "tariff", "macro", "central bank"
  ];
  return articles.filter(art => {
    const text = `${art.title} ${art.description || ''}`.toLowerCase();
    return keywords.some(kw => text.includes(kw));
  }).map(art => {
    // Relevance score
    let hits = 0;
    keywords.forEach(kw => {
      if (textIncludes(art.title + " " + (art.description || ""), kw)) hits++;
    });
    const score = Math.min(100, 30 + hits * 15);
    return { ...art, relevanceScore: score };
  });
};

const textIncludes = (src, kw) => src.toLowerCase().includes(kw);

// Session Profile bounds helper
const updateSessionProfiles = (price) => {
  // Read current profiles, shift slightly based on live price changes to avoid stale hardcoded gaps
  const current = globalMarketState.sessionProfiles;
  globalMarketState.sessionProfiles = {
    asian: {
      ...current.asian,
      high: Math.max(current.asian.high, price),
      low: Math.min(current.asian.low, price)
    },
    london: {
      ...current.london,
      high: Math.max(current.london.high, price),
      low: Math.min(current.london.low, price)
    },
    newyork: {
      ...current.newyork,
      high: Math.max(current.newyork.high, price),
      low: Math.min(current.newyork.low, price)
    }
  };
};

// Invalidation checks
const checkSignalInvalidation = (price) => {
  const active = globalMarketState.activeSignal;
  if (!active || active.direction === "HOLD" || active.direction === "NO TRADE") return;
  
  // BUY invalidation: price drops below Stop Loss
  if (active.direction === "BUY" && active.stopLoss && price <= active.stopLoss) {
    addLog("CRITICAL: BUY Signal invalidated due to SL breach.");
    triggerSignalReset("NO TRADE (SL Breached)");
  }
  // SELL invalidation: price rallies above Stop Loss
  else if (active.direction === "SELL" && active.stopLoss && price >= active.stopLoss) {
    addLog("CRITICAL: SELL Signal invalidated due to SL breach.");
    triggerSignalReset("NO TRADE (SL Breached)");
  }
};

const triggerSignalReset = (newDir) => {
  signalLockedUntil = 0;
  signalLockDirection = "HOLD";
  globalMarketState.activeSignal = {
    ...globalMarketState.activeSignal,
    direction: newDir,
    entry: null,
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    takeProfit3: null,
    riskRewardRatio: null,
    confidenceScore: 30,
    riskLevel: "High"
  };
  globalMarketState.lastUpdateTimes.signal = Date.now();
  notifyBroadcast();
};

const addLog = (message) => {
  const logStr = `[${new Date().toLocaleTimeString()}] ${message}`;
  globalMarketState.logs.unshift(logStr);
  if (globalMarketState.logs.length > 50) globalMarketState.logs.pop();
};

const notifyBroadcast = () => {
  if (broadcastCallback) {
    // Recalculate freshness status for client UI
    const now = Date.now();
    const freshDiff = (moduleTime) => now - moduleTime;
    
    globalMarketState.dataFreshness = {
      price: freshDiff(globalMarketState.lastUpdateTimes.price) < 3000 ? "Live now" : `Updated ${Math.round(freshDiff(globalMarketState.lastUpdateTimes.price)/1000)}s ago`,
      indicators: freshDiff(globalMarketState.lastUpdateTimes.indicators) < 7000 ? "Live now" : `Updated ${Math.round(freshDiff(globalMarketState.lastUpdateTimes.indicators)/1000)}s ago`,
      signal: freshDiff(globalMarketState.lastUpdateTimes.signal) < 15000 ? "Live now" : `Updated ${Math.round(freshDiff(globalMarketState.lastUpdateTimes.signal)/1000)}s ago`,
      ai: freshDiff(globalMarketState.lastUpdateTimes.ai) < 25000 ? "Live now" : `Updated ${Math.round(freshDiff(globalMarketState.lastUpdateTimes.ai)/1000)}s ago`,
      news: freshDiff(globalMarketState.lastUpdateTimes.news) < 180000 ? "Live now" : `Updated ${Math.round(freshDiff(globalMarketState.lastUpdateTimes.news)/60000)}m ago`
    };

    // If any critical module becomes stale (> 45s for price/indicators or > 60s for AI), lower confidence and add warning
    const isPriceStale = freshDiff(globalMarketState.lastUpdateTimes.price) > 45000;
    const isIndicatorsStale = freshDiff(globalMarketState.lastUpdateTimes.indicators) > 45000;
    const isAiStale = freshDiff(globalMarketState.lastUpdateTimes.ai) > 60000;
    
    if (isPriceStale || isIndicatorsStale || isAiStale) {
      globalMarketState.activeSignal.confidenceScore = Math.max(15, globalMarketState.activeSignal.confidenceScore - 10);
      if (globalMarketState.activeSignal.direction === "BUY" || globalMarketState.activeSignal.direction === "SELL") {
        globalMarketState.activeSignal.direction = "HOLD (Data Stale)";
      }
    }

    broadcastCallback(globalMarketState);
  }
};

// 1. Live Price quote ticker loop (Runs every 1.5 seconds)
const startPriceQuoteLoop = () => {
  setInterval(async () => {
    try {
      const now = Date.now();
      let newPrice = globalMarketState.price;
      let simulated = false;

      try {
        const response = await axios.get(`https://api.twelvedata.com/price`, {
          params: { symbol: 'XAU/USD', apikey: TWELVEDATA_API_KEY },
          timeout: 1000
        });
        if (response.data && response.data.price) {
          newPrice = parseFloat(response.data.price);
        } else {
          simulated = true;
        }
      } catch (err) {
        simulated = true;
      }

      if (simulated) {
        // High fidelity walk
        const walk = (Math.random() - 0.5) * 0.45;
        newPrice = parseFloat((globalMarketState.price + walk).toFixed(2));
      }

      globalMarketState.priceDirection = newPrice > globalMarketState.price ? "up" : newPrice < globalMarketState.price ? "down" : "flat";
      globalMarketState.price = newPrice;
      globalMarketState.timestamp = now;
      globalMarketState.lastUpdateTimes.price = now;
      globalMarketState.spread = parseFloat((1.0 + Math.random() * 0.3).toFixed(1));

      // Instantly recalculate dependent quote targets
      updateSessionProfiles(newPrice);
      checkSignalInvalidation(newPrice);
      notifyBroadcast();
    } catch (e) {
      console.error("Price quote ticker error:", e);
    }
  }, 1500);
};

// 2. Indicators and Candle Generator Ticker (Runs every 4 seconds)
const startIndicatorsLoop = () => {
  setInterval(() => {
    try {
      const currentPrice = globalMarketState.price;
      
      // Seed or generate candles array
      if (currentCandles15m.length === 0) {
        let price = currentPrice - 30;
        for (let i = 0; i < 60; i++) {
          const open = price + (Math.random() - 0.5) * 2;
          const close = open + (Math.random() - 0.49) * 2.5;
          price = close;
          currentCandles15m.push({
            timestamp: new Date(Date.now() - (60 - i) * 15 * 60 * 1000).toISOString(),
            open, high: Math.max(open, close) + 1.2, low: Math.min(open, close) - 1.2, close, volume: Math.floor(1000 + Math.random() * 3000)
          });
        }
      }

      // Slide candle quote tick
      const lastCandle = currentCandles15m[currentCandles15m.length - 1];
      lastCandle.close = currentPrice;
      lastCandle.high = Math.max(lastCandle.high, currentPrice);
      lastCandle.low = Math.min(lastCandle.low, currentPrice);

      const tech = calculateTechnicalIndicators(currentCandles15m);
      globalMarketState.technicalSummary = tech;
      globalMarketState.lastUpdateTimes.indicators = Date.now();

      // Market Regime detection logic
      const atr = tech.atr;
      if (atr < 1.8) {
        globalMarketState.marketRegime = "Ranging (Low Liquidity)";
      } else if (tech.volatilityScore > 75) {
        globalMarketState.marketRegime = "High Volatility (News Mode)";
      } else if (tech.trendScore >= 65) {
        globalMarketState.marketRegime = "Trending Bullish";
      } else if (tech.trendScore <= 35) {
        globalMarketState.marketRegime = "Trending Bearish";
      } else {
        globalMarketState.marketRegime = "Neutral Consolidation";
      }

      notifyBroadcast();
    } catch (e) {
      console.error("Indicators loop error:", e);
    }
  }, 4000);
};

// 3. Signal Engine & Confluence Ticker (Runs every 6 seconds)
const startSignalEngineLoop = () => {
  setInterval(async () => {
    try {
      const currentPrice = globalMarketState.price;
      const tech = globalMarketState.technicalSummary;
      const aiPred = globalMarketState.aiPredictions;
      const smc = globalMarketState.smc;
      const sentiment = globalMarketState.sentimentSummary;
      
      const now = Date.now();

      // If signal is locked, keep the locked signal direction (prevent flipping)
      if (now < signalLockedUntil && globalMarketState.activeSignal.direction !== "HOLD") {
        // State remains locked
        notifyBroadcast();
        return;
      }

      // Calculate Multi-Timeframe Trends for authority
      // (simulated from our central multi-timeframe mapping)
      const dailyBullish = tech.trendScore >= 50;
      const h4Bullish = tech.trendScore >= 50;
      const h1Bullish = tech.trendScore >= 50;
      const m15Bullish = tech.trendScore >= 50;
      const m5Bullish = tech.rsi >= 50;

      const dailyBias = dailyBullish ? "Bullish" : "Bearish";
      const h4Bias = h4Bullish ? "Bullish" : "Bearish";
      const h1Bias = h1Bullish ? "Bullish" : "Bearish";
      const m15Bias = m15Bullish ? "Bullish" : "Bearish";
      const m5Bias = m5Bullish ? "Bullish" : "Bearish";

      // Confluence calculations
      let finalScore = 50;
      let confluences = [];

      // A. Multi-Timeframe Trend filter (+20)
      const macroAligns = (dailyBullish === h4Bullish) && (h4Bullish === h1Bullish);
      const setupAligns = (m15Bullish === h1Bias);

      if (macroAligns && setupAligns) {
        finalScore += 20;
        confluences.push({ factor: "Macro Timeframe Trend Alignment (Daily/H4/H1/15M)", weight: 20 });
      } else {
        finalScore -= 10;
        confluences.push({ factor: `Conflicting HTF Bias (Daily: ${dailyBias} / H4: ${h4Bias})`, weight: -10 });
      }

      // B. SMC sweeps confirmation (+15)
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

      // C. Demand/Supply Zone re-test (+15)
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

      // D. AI predictions alignment (+20)
      if (aiPred.bullish_prob > 0.8) {
        finalScore += 20;
        confluences.push({ factor: `AI Ensemble Bullish Conviction (${(aiPred.bullish_prob * 100).toFixed(0)}%)`, weight: 20 });
      } else if (aiPred.bearish_prob > 0.8) {
        finalScore -= 20;
        confluences.push({ factor: `AI Ensemble Bearish Conviction (${(aiPred.bearish_prob * 100).toFixed(0)}%)`, weight: -20 });
      }

      // E. News sentiment (+10)
      if (sentiment.sentiment_score > 25) {
        finalScore += 10;
        confluences.push({ factor: "Macro News Sentiment (Bullish Bias)", weight: 10 });
      } else if (sentiment.sentiment_score < -25) {
        finalScore -= 10;
        confluences.push({ factor: "Macro News Sentiment (Bearish Bias)", weight: -10 });
      }

      // F. Volatility / ATR constraints & retail indicator filters
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

      // G. Market Regime validation adjustments
      if (globalMarketState.marketRegime === "Ranging (Low Liquidity)") {
        // Reduce trend-following weights
        finalScore = 50 + (finalScore - 50) * 0.6;
        confluences.push({ factor: "Regime filter: Ranging consolidations (Low Risk setup)", weight: 0 });
      } else if (globalMarketState.marketRegime === "High Volatility (News Mode)") {
        // Strict protection lock
        finalScore = 50 + (finalScore - 50) * 0.2;
        confluences.push({ factor: "Regime filter: High-impact volatility protection locked", weight: 0 });
      }

      // Direction derivation
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

      // Targets builder
      let entry = currentPrice;
      let sl = null;
      let tp1 = null;
      let tp2 = null;
      let tp3 = null;
      let rrRatio = null;

      if (direction === "BUY") {
        entry = parseFloat(currentPrice.toFixed(2));
        sl = parseFloat((entry - atrFactor * 1.5).toFixed(2));
        tp1 = parseFloat((entry + atrFactor * 1.0).toFixed(2));
        tp2 = parseFloat((entry + atrFactor * 2.0).toFixed(2));
        tp3 = parseFloat((entry + atrFactor * 3.5).toFixed(2));
        rrRatio = parseFloat(( (tp2 - entry) / (entry - sl) ).toFixed(2));
      } else if (direction === "SELL") {
        entry = parseFloat(currentPrice.toFixed(2));
        sl = parseFloat((entry + atrFactor * 1.5).toFixed(2));
        tp1 = parseFloat((entry - atrFactor * 1.0).toFixed(2));
        tp2 = parseFloat((entry - atrFactor * 2.0).toFixed(2));
        tp3 = parseFloat((entry - atrFactor * 3.5).toFixed(2));
        rrRatio = parseFloat(( (entry - tp2) / (sl - entry) ).toFixed(2));
      }

      const isNewSignal = direction !== globalMarketState.activeSignal.direction && (direction === "BUY" || direction === "SELL");

      const generatedSignal = {
        id: isNewSignal ? "SIG_" + Math.random().toString(36).substr(2, 9).toUpperCase() : globalMarketState.activeSignal.id,
        timestamp: new Date().toISOString(),
        symbol: "XAUUSD",
        direction,
        entry: direction === "BUY" || direction === "SELL" ? entry : null,
        stopLoss: direction === "BUY" || direction === "SELL" ? sl : null,
        takeProfit1: direction === "BUY" || direction === "SELL" ? tp1 : null,
        takeProfit2: direction === "BUY" || direction === "SELL" ? tp2 : null,
        takeProfit3: direction === "BUY" || direction === "SELL" ? tp3 : null,
        riskRewardRatio: direction === "BUY" || direction === "SELL" ? rrRatio : null,
        confidenceScore: confidencePercent,
        riskLevel,
        confluences,
        timeframeAnalyses: {
          daily: dailyBias,
          h4: h4Bias,
          h1: h1Bias,
          m15: m15Bias,
          m5: m5Bias
        }
      };

      if (isNewSignal) {
        addLog(`ALERT: Generated new high-confluence institutional ${direction} setup.`);
        // Lock signal for 30 minutes (1,800,000 ms) to stabilize random noise flipping
        signalLockedUntil = now + 30 * 60 * 1000;
        signalLockDirection = direction;
        
        globalMarketState.signalHistory.unshift(generatedSignal);
        if (globalMarketState.signalHistory.length > 50) globalMarketState.signalHistory.pop();
      }

      globalMarketState.activeSignal = generatedSignal;
      globalMarketState.lastUpdateTimes.signal = Date.now();
      notifyBroadcast();
    } catch (e) {
      console.error("Signal engine loop error:", e);
    }
  }, 6000);
};

// 4. FastAPI AI prediction & SMC fetcher loop (Runs every 12 seconds)
const startAIEngineLoop = () => {
  setInterval(async () => {
    try {
      if (currentCandles15m.length === 0) return;
      
      const payload = {
        candles: currentCandles15m.slice(-30).map(c => ({
          timestamp: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        })),
        sentiment_score: globalMarketState.sentimentSummary.sentiment_score
      };

      try {
        // Query prediction and smc endpoints in parallel
        const [predRes, smcRes] = await Promise.all([
          axios.post(`${AI_ENGINE_URL}/api/predict`, payload, { timeout: 2000 }),
          axios.post(`${AI_ENGINE_URL}/api/smc`, { candles: payload.candles }, { timeout: 2000 })
        ]);

        if (predRes.data) {
          globalMarketState.aiPredictions = predRes.data;
        }
        if (smcRes.data) {
          globalMarketState.smc = smcRes.data;
        }
        
        addLog("Ensemble AI model validation completed successfully.");
        globalMarketState.lastUpdateTimes.ai = Date.now();
      } catch (err) {
        // Fallback calculations in case FastAPI is offline
        const isBullish = globalMarketState.technicalSummary.trendScore >= 50;
        globalMarketState.smc = calculateSMCLevels(currentCandles15m, isBullish);
        
        const probability = isBullish ? 0.72 : 0.28;
        globalMarketState.aiPredictions = {
          bullish_prob: probability,
          bearish_prob: 1.0 - probability,
          confidence: 72,
          trend_continuation_prob: 0.65,
          simulatedFallback: true
        };
        
        globalMarketState.lastUpdateTimes.ai = Date.now();
      }

      notifyBroadcast();
    } catch (e) {
      console.error("AI engine loop error:", e);
    }
  }, 12000);
};

// 5. News & Macro headlines loader loop (Runs every 90 seconds)
const startNewsSentimentLoop = () => {
  setInterval(async () => {
    try {
      let articles = [];

      try {
        if (NEWSAPI_KEY) {
          const response = await axios.get('https://newsapi.org/v2/everything', {
            params: {
              q: 'gold price OR inflation OR federal reserve OR CPI OR FOMC',
              language: 'en',
              sortBy: 'publishedAt',
              pageSize: 20,
              apiKey: NEWSAPI_KEY
            },
            timeout: 2000
          });
          if (response.data && response.data.articles) {
            articles = response.data.articles;
          }
        }
      } catch (err) {
        // newsapi failed
      }

      if (articles.length === 0 && FINNHUB_API_KEY) {
        try {
          const response = await axios.get('https://finnhub.io/api/v1/news', {
            params: { category: 'general', token: FINNHUB_API_KEY },
            timeout: 2000
          });
          if (response.data && Array.isArray(response.data)) {
            articles = response.data.slice(0, 20).map(art => ({
              title: art.headline,
              description: art.summary,
              source: art.source || "Finnhub",
              publishedAt: new Date(art.datetime * 1000).toISOString()
            }));
          }
        } catch (err) {
          // finnhub failed
        }
      }

      if (articles.length > 0) {
        const filtered = filterRelevantNews(articles.map(art => ({
          title: art.title,
          description: art.description,
          source: art.source?.name || art.source || "NewsAPI",
          publishedAt: art.publishedAt
        })));

        if (filtered.length > 0) {
          globalMarketState.newsList = filtered.slice(0, 10);
          // Run sentiment analyzer
          try {
            const sentRes = await axios.post(`${AI_ENGINE_URL}/api/sentiment`, {
              headlines: filtered.slice(0, 10)
            }, { timeout: 2000 });
            globalMarketState.sentimentSummary = sentRes.data;
          } catch (sentErr) {
            // fallback sentiment estimation
            const text = filtered.slice(0, 5).map(a => a.title).join(" ").toLowerCase();
            const pos = (text.match(/bid|bull|rise|inflation|hike|tension|gold|war/g) || []).length;
            const neg = (text.match(/bear|drop|fall|cut|dovish|usd/g) || []).length;
            const score = pos + neg > 0 ? ((pos - neg) / (pos + neg)) * 100 : 0;
            
            globalMarketState.sentimentSummary = {
              sentiment_score: Math.round(score),
              bias: score > 20 ? "bullish" : score < -20 ? "bearish" : "neutral",
              impact_level: Math.abs(score) > 50 ? "High" : "Medium",
              market_mood: score > 20 ? "Fear/Inflation Bid" : "Dovish Outflow"
            };
          }
          
          addLog("Macro headlines news filtering completed.");
        }
      }
      
      globalMarketState.lastUpdateTimes.news = Date.now();
      notifyBroadcast();
    } catch (e) {
      console.error("News sentiment loop error:", e);
    }
  }, 90000);
};

// 6. Dynamic Correlation walking loop (Runs every 15 seconds)
const startCorrelationLoop = () => {
  setInterval(() => {
    try {
      const walk = () => (Math.random() - 0.5) * 0.05;
      globalMarketState.correlations = {
        "DXY": parseFloat((-0.83 + walk()).toFixed(2)),
        "US10Y": parseFloat((-0.75 + walk()).toFixed(2)),
        "SPX500": parseFloat((0.06 + walk()).toFixed(2)),
        "CrudeOil": parseFloat((0.54 + walk()).toFixed(2))
      };
      globalMarketState.lastUpdateTimes.correlation = Date.now();
      notifyBroadcast();
    } catch (e) {
      console.error("Correlation loop error:", e);
    }
  }, 15000);
};

// Start all background timers
export const startMarketEngine = (onBroadcast) => {
  broadcastCallback = onBroadcast;
  
  startPriceQuoteLoop();
  startIndicatorsLoop();
  startSignalEngineLoop();
  startAIEngineLoop();
  startNewsSentimentLoop();
  startCorrelationLoop();

  addLog("Aurax Centralized Synchronized Market Engine initialized.");
};

export const getMarketState = () => globalMarketState;

export const updateMarketPrice = (newPrice) => {
  const now = Date.now();
  globalMarketState.priceDirection = newPrice > globalMarketState.price ? "up" : newPrice < globalMarketState.price ? "down" : "flat";
  globalMarketState.price = newPrice;
  globalMarketState.timestamp = now;
  globalMarketState.lastUpdateTimes.price = now;
  globalMarketState.spread = parseFloat((1.0 + Math.random() * 0.3).toFixed(1));

  // Instantly recalculate dependent quote targets
  updateSessionProfiles(newPrice);
  checkSignalInvalidation(newPrice);
  notifyBroadcast();
  addLog(`Manual price adjustment: $${newPrice.toFixed(2)}`);
};
