// Helper to calculate technical indicators locally in JS
export const calculateTechnicalIndicators = (candles) => {
  if (!candles || candles.length === 0) {
    return {
      ema20: 0, ema50: 0, ema200: 0, rsi: 50, atr: 1.5,
      macd: { macdLine: 0, signalLine: 0, histogram: 0 },
      bb: { upper: 0, middle: 0, lower: 0 },
      trendScore: 50, volatilityScore: 30, bullishIndication: "Neutral Consolidation"
    };
  }

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
export const calculateSessionProfiles = (candles) => {
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
export const calculateSMCLevels = (candles, isBullish) => {
  if (!candles || candles.length === 0) {
    return { fvgs: [], order_blocks: [], market_structure: [], liquidity_sweeps: [], supply_demand_zones: [] };
  }
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
