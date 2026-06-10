"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  TrendingUp, TrendingDown, Cpu, Activity, ShieldAlert, Clock, 
  RefreshCw, Save, ArrowRight, Share2, Layers, MessageSquare, AlertCircle, BarChart3
} from "lucide-react";

const BACKEND_URL = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/_/backend"
  : "http://localhost:5000";

// Interface Definitions
interface Signal {
  id: string;
  timestamp?: string;
  symbol: string;
  direction: string;
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  riskRewardRatio: number | null;
  confidenceScore: number;
  riskLevel: string;
  confluences: { factor: string; weight: number }[];
  engineConnected?: boolean;
  smcLevels?: {
    fvgs: any[];
    order_blocks: any[];
    market_structure: any[];
    liquidity_sweeps: any[];
    supply_demand_zones: any[];
  };
  technicalIndicators?: any;
  aiPredictions?: any;
  timeframeAnalyses?: {
    daily: string;
    h4: string;
    h1: string;
    m15: string;
    m5: string;
  };
}

export default function TerminalPage() {
  const [timeframe, setTimeframe] = useState<string>("15m");
  const [livePrice, setLivePrice] = useState<number>(4335.50);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | "flat">("flat");
  const [spread, setSpread] = useState<number>(1.2);
  const [volatility, setVolatility] = useState<string>("Medium");
  const [sessionName, setSessionName] = useState<string>("New York (Open)");
  
  // Terminal state
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const [techSummary, setTechSummary] = useState<any>(null);
  const [sentimentSummary, setSentimentSummary] = useState<any>(null);
  const [correlations, setCorrelations] = useState<any>(null);
  const [newsList, setNewsList] = useState<any[]>([]);
  const [savedSetups, setSavedSetups] = useState<any[]>([]);
  const [sessionProfiles, setSessionProfiles] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  
  // Telemetry status
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [isAiEngineOnline, setIsAiEngineOnline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string>("");

  const scriptLoaded = useRef(false);

  // 1. Initialize TradingView Widget
  useEffect(() => {
    // Avoid double mounting in React StrictMode
    if (scriptLoaded.current) return;
    
    const loadTradingViewScript = () => {
      const script = document.createElement("script");
      script.id = "tradingview-widget-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = () => {
        if (typeof window !== "undefined" && (window as any).TradingView) {
          scriptLoaded.current = true;
          mountWidget("15");
        }
      };
      document.head.appendChild(script);
    };

    if (!document.getElementById("tradingview-widget-script")) {
      loadTradingViewScript();
    } else if ((window as any).TradingView) {
      scriptLoaded.current = true;
      mountWidget("15");
    }
  }, []);

  const mountWidget = (intervalStr: string) => {
    if (typeof window !== "undefined" && (window as any).TradingView) {
      new (window as any).TradingView.widget({
        width: "100%",
        height: "100%",
        symbol: "OANDA:XAUUSD",
        interval: intervalStr,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0B0B0C",
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        container_id: "tradingview_chart_container",
        studies: [
          "MASimple@tv-basicstudies",
          "RSI@tv-basicstudies"
        ],
        loading_screen: { backgroundColor: "#0B0B0C" }
      });
    }
  };

  // Intelligence Polling Status
  const [liveStatus, setLiveStatus] = useState<"LIVE" | "UPDATING" | "AI ANALYZING" | "OFFLINE">("LIVE");

  // Fetch News and Sentiment (Slower Loop - every 90 seconds)
  const fetchNews = async () => {
    try {
      const newsRes = await fetch(`${BACKEND_URL}/api/market/news`);
      const newsData = await newsRes.json();
      if (Array.isArray(newsData)) {
        setNewsList(newsData);
      }
    } catch (e) {
      console.warn("Failed to fetch news:", e);
    }
  };

  // Fetch Correlation
  const fetchCorrelation = async () => {
    try {
      const corrRes = await fetch(`${BACKEND_URL}/api/market/correlation`);
      const corrData = await corrRes.json();
      if (corrData && corrData.correlations) {
        setCorrelations(corrData.correlations);
      }
    } catch (e) {
      setCorrelations({ "DXY": -0.83, "US10Y": -0.76, "SPX500": 0.05, "CrudeOil": 0.54 });
    }
  };

  // Fetch Price & Signals (Fast Loop - every 3.5 seconds)
  const pollIntelligence = async (currentTimeframe: string) => {
    setLiveStatus("UPDATING");
    let currentPriceVal = livePrice;
    
    // Fetch latest price
    try {
      const priceRes = await fetch(`${BACKEND_URL}/api/market/price`);
      const priceData = await priceRes.json();
      if (priceData && priceData.price) {
        setLivePrice((prev) => {
          if (priceData.price > prev) setPriceDirection("up");
          else if (priceData.price < prev) setPriceDirection("down");
          else setPriceDirection("flat");
          return priceData.price;
        });
        currentPriceVal = priceData.price;
        setSpread(parseFloat((1.0 + Math.random() * 0.4).toFixed(1)));
        setIsBackendOnline(true);
      }
    } catch (e) {
      console.warn("Failed to fetch live price:", e);
      // Offline simulated price movement
      setLivePrice((prev) => {
        const walk = (Math.random() - 0.5) * 0.35;
        setPriceDirection(walk > 0 ? "up" : walk < 0 ? "down" : "flat");
        return parseFloat((prev + walk).toFixed(2));
      });
    }

    setLiveStatus("AI ANALYZING");

    // Fetch latest signals & technical indicators
    try {
      const signalRes = await fetch(`${BACKEND_URL}/api/signals/generate?timeframe=${currentTimeframe}`);
      const signalPayload = await signalRes.json();
      if (signalPayload && signalPayload.activeSignal) {
        setActiveSignal(signalPayload.activeSignal);
        setTechSummary(signalPayload.technicalSummary);
        setSentimentSummary(signalPayload.sentimentSummary);
        if (signalPayload.sessionProfiles) {
          setSessionProfiles(signalPayload.sessionProfiles);
        } else {
          // Fallback if not returned
          setSessionProfiles({
            asian: { high: currentPriceVal + 4.5, low: currentPriceVal - 11.2, status: "Accumulation complete" },
            london: { high: currentPriceVal + 9.8, low: currentPriceVal - 14.5, status: "Asian Sweep Hunt detected" },
            newyork: { high: currentPriceVal + 13.6, low: currentPriceVal - 8.9, status: "Distribution phase active" }
          });
        }
        setIsBackendOnline(true);
        setIsAiEngineOnline(signalPayload.activeSignal.engineConnected);
        setVolatility(signalPayload.technicalSummary.volatilityScore > 65 ? "High" : signalPayload.technicalSummary.volatilityScore > 35 ? "Medium" : "Low");
      }
    } catch (e) {
      console.warn("Failed to fetch active signals:", e);
      // Local offline fallback simulation using local helper
      simulateLocalConfluence(currentPriceVal);
      setIsBackendOnline(false);
      setIsAiEngineOnline(false);
    }
    
    setLiveStatus("LIVE");
  };

  const simulateLocalConfluence = (price: number) => {
    // Generate simulated indicators
    setTechSummary({
      ema20: price - 3.5,
      ema50: price - 8.2,
      ema200: price - 24.10,
      rsi: 58.4,
      atr: 4.80,
      macd: { macdLine: 0.24, signalLine: 0.18, histogram: 0.06 },
      bb: { upper: price + 15.0, middle: price, lower: price - 15.0 },
      trendScore: 75,
      volatilityScore: 48,
      bullishIndication: "Bullish Alignment (Offline Mode)"
    });

    setSentimentSummary({
      sentiment_score: 45,
      bias: "bullish",
      impact_level: "Medium",
      market_mood: "Risk-Off (Geopolitical Risk)"
    });

    setSessionProfiles({
      asian: { high: price + 4.5, low: price - 11.2, status: "Accumulation complete" },
      london: { high: price + 9.8, low: price - 14.5, status: "Asian Sweep Hunt detected" },
      newyork: { high: price + 13.6, low: price - 8.9, status: "Distribution phase active" }
    });

    setActiveSignal({
      id: "SIG_OFFLINE_XAU",
      symbol: "XAUUSD",
      direction: "BUY",
      entry: price,
      stopLoss: parseFloat((price - 12.0).toFixed(2)),
      takeProfit1: parseFloat((price + 15.0).toFixed(2)),
      takeProfit2: parseFloat((price + 28.0).toFixed(2)),
      takeProfit3: parseFloat((price + 45.0).toFixed(2)),
      riskRewardRatio: 2.33,
      confidenceScore: 72,
      riskLevel: "Medium",
      confluences: [
        { factor: "EMA Trend Alignment (Bullish)", weight: 20 },
        { factor: "AI Trend Probability (Simulated)", weight: 20 },
        { factor: "Macro News Sentiment (Bullish)", weight: 15 }
      ],
      smcLevels: {
        fvgs: [{ type: "bullish", top: price * 1.002, bottom: price * 0.998, mitigated: false }],
        order_blocks: [
          { type: "bullish", top: price * 0.996, bottom: price * 0.992, strength: "High", mitigated: false },
          { type: "bearish", top: price * 1.008, bottom: price * 1.004, strength: "High", mitigated: false }
        ],
        market_structure: [{ type: "bullish", structure: "BOS", price: price * 0.99, timestamp: new Date().toISOString() }],
        liquidity_sweeps: [{ type: "bullish", price_swept: price * 0.995, timestamp: new Date().toISOString() }],
        supply_demand_zones: [
          { type: "demand", top: price * 0.995, bottom: price * 0.992, strength: "High" },
          { type: "supply", top: price * 1.008, bottom: price * 1.005, strength: "High" }
        ]
      }
    });
  };

  // Main lifecycle update loops
  useEffect(() => {
    // Initial fetch sequences
    fetchNews();
    fetchCorrelation();
    pollIntelligence(timeframe);

    // Fast intelligence update loop (3.5s)
    const intelInterval = setInterval(() => {
      pollIntelligence(timeframe);
    }, 3500);

    return () => clearInterval(intelInterval);
  }, [timeframe]);

  // Slower background updates (90s for news, 5m for correlations)
  useEffect(() => {
    const newsInterval = setInterval(fetchNews, 90000);
    const corrInterval = setInterval(fetchCorrelation, 300000);
    return () => {
      clearInterval(newsInterval);
      clearInterval(corrInterval);
    };
  }, []);

  // Countdown timer for 30-minute signal lock
  useEffect(() => {
    if (!activeSignal || !activeSignal.timestamp) {
      setTimeRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const signalTime = new Date(activeSignal.timestamp || "").getTime();
      const nextSignalTime = signalTime + 1800000; // 30 minutes in ms
      const now = Date.now();
      const diff = nextSignalTime - now;

      if (diff <= 0) {
        setTimeRemaining("00:00");
        pollIntelligence(timeframe);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeSignal, timeframe]);

  const handleManualRefresh = () => {
    fetchNews();
    fetchCorrelation();
    pollIntelligence(timeframe);
  };

  // Timeframe selector handling
  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    const intervals: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1H': '60', '4H': '240', 'Daily': 'D'
    };
    mountWidget(intervals[tf] || '15');
  };

  // Save current trading setup
  const saveSetup = async () => {
    if (!activeSignal) return;
    setSaveStatus("Saving...");
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "XAUUSD",
          direction: activeSignal.direction,
          entry: activeSignal.entry || livePrice,
          stopLoss: activeSignal.stopLoss,
          takeProfit1: activeSignal.takeProfit1,
          takeProfit2: activeSignal.takeProfit2,
          confidenceScore: activeSignal.confidenceScore,
          timeframe
        })
      });
      const data = await res.json();
      if (data.success) {
        setSavedSetups((prev) => [data.savedSetup, ...prev]);
        setSaveStatus("Saved!");
        setTimeout(() => setSaveStatus(""), 2000);
      }
    } catch (e) {
      // local mockup save
      const mockSaved = {
        id: "SAV_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        symbol: "XAUUSD",
        direction: activeSignal.direction,
        entry: activeSignal.entry || livePrice,
        stopLoss: activeSignal.stopLoss,
        takeProfit1: activeSignal.takeProfit1,
        takeProfit2: activeSignal.takeProfit2,
        confidenceScore: activeSignal.confidenceScore,
        timeframe,
        savedAt: new Date().toISOString()
      };
      setSavedSetups((prev) => [mockSaved, ...prev]);
      setSaveStatus("Saved (Simulated)!");
      setTimeout(() => setSaveStatus(""), 2000);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-obsidian-950 font-sans overflow-hidden">
      
      {/* Top Banner Status Bar */}
      <div className="bg-obsidian-900 border-b border-gold-900/10 py-1.5 px-4 flex justify-between items-center text-[10px] font-mono tracking-wider text-gray-400">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse" />
            <span className="text-gray-200">AURAX TELEMETRY</span>
          </div>
          <div className="h-3 w-px bg-gold-900/15" />
          <div>
            SESSION: <span className="text-gold-500 font-bold uppercase">{sessionName}</span>
          </div>
          <div className="h-3 w-px bg-gold-900/15 hidden sm:block" />
          <div className="hidden sm:block">
            VOLATILITY: <span className="text-gray-200">{volatility.toUpperCase()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>PROXY: {isBackendOnline ? 'ONLINE' : 'FALLBACK'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isAiEngineOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>AI ENGINE: {isAiEngineOnline ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Header */}
      <header className="glass-panel border-b border-gold-900/10 py-3.5 px-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-300 via-gold-500 to-gold-700 flex items-center justify-center">
              <span className="font-mono font-black text-obsidian-950 text-base tracking-tighter">AX</span>
            </div>
            <div className="leading-none">
              <h2 className="font-mono font-bold text-sm tracking-wider text-white">AURAX <span className="text-gold-500">AI</span></h2>
              <span className="text-[9px] uppercase tracking-widest text-gold-600 block">GOLD TERMINAL</span>
            </div>
          </Link>
          
          <div className="h-6 w-px bg-gold-900/20" />
          
          {/* Live Quote details */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-400">XAU/USD:</span>
            <span className={`text-sm font-mono font-bold tracking-widest transition-colors ${priceDirection === 'up' ? 'text-emerald-500' : priceDirection === 'down' ? 'text-red-500' : 'text-gold-500'}`}>
              ${livePrice.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-obsidian-800 border border-gold-900/10 text-gray-300">
              Spread: {spread} pips
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-xs font-mono">
          <Link href="/dashboard" className="text-gray-400 hover:text-gold-500 transition-colors">Dashboard</Link>
          <Link href="/admin" className="text-gray-400 hover:text-gold-500 transition-colors">Admin Panel</Link>
          <Link href="/" className="text-gray-400 hover:text-gold-500 transition-colors">Exit</Link>
        </nav>
      </header>

      {/* Main Terminal Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto">
        
        {/* Left Section (Chart, Sessions, Correlations) - 9 Columns */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          
          {/* Timeframe Selector & Chart Panel */}
          <div className="glass-panel rounded-lg flex-1 flex flex-col min-h-[450px]">
            <div className="flex justify-between items-center p-3 border-b border-gold-900/10 bg-obsidian-900/50">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gold-500" />
                <span className="text-xs font-mono font-bold text-gray-200">INTERACTIVE XAUUSD CHART</span>
              </div>
              <div className="flex gap-1">
                {['1m', '5m', '15m', '30m', '1H', '4H', 'Daily'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleTimeframeChange(tf)}
                    className={`font-mono text-[10px] px-2.5 py-1 rounded transition-all ${timeframe === tf ? 'bg-gold-500 text-obsidian-950 font-bold' : 'text-gray-400 hover:bg-obsidian-800'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 w-full bg-obsidian-950 relative">
              <div id="tradingview_chart_container" className="absolute inset-0 w-full h-full" />
            </div>
          </div>

          {/* Session Timeline Visualizer */}
          <div className="glass-panel rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-mono font-bold text-gray-200 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-gold-500" /> SESSION LIQUIDITY PROFILES
            </h3>
            
            <div className="grid grid-cols-3 gap-4 font-mono text-[11px]">
              
              {/* Asian Session */}
              <div className="border border-gold-900/10 bg-obsidian-900/20 p-3 rounded">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 font-bold">Asian Session</span>
                  <span className="text-[9px] text-gray-500">22:00 - 06:00 UTC</span>
                </div>
                <div className="space-y-1 text-gray-400 text-[10px] pt-1">
                  <div>Range High: <span className="text-gold-500">${sessionProfiles ? sessionProfiles.asian.high.toFixed(2) : (livePrice + 4.5).toFixed(2)}</span></div>
                  <div>Range Low: <span className="text-gold-500">${sessionProfiles ? sessionProfiles.asian.low.toFixed(2) : (livePrice - 11.2).toFixed(2)}</span></div>
                  <div className="text-emerald-500 font-semibold uppercase bg-emerald-950/20 py-0.5 px-1.5 rounded mt-1.5 text-center">
                    {sessionProfiles ? sessionProfiles.asian.status : "Accumulation complete"}
                  </div>
                </div>
              </div>

              {/* London Session */}
              <div className="border border-gold-500/20 bg-obsidian-900/40 p-3 rounded shadow-[0_0_10px_rgba(212,175,55,0.02)]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gold-500 font-bold">London Session</span>
                  <span className="text-[9px] text-gray-500">07:00 - 15:00 UTC</span>
                </div>
                <div className="space-y-1 text-gray-400 text-[10px] pt-1">
                  <div>Session High: <span className="text-gold-500">${sessionProfiles ? sessionProfiles.london.high.toFixed(2) : (livePrice + 9.8).toFixed(2)}</span></div>
                  <div>Session Low: <span className="text-gold-500">${sessionProfiles ? sessionProfiles.london.low.toFixed(2) : (livePrice - 14.5).toFixed(2)}</span></div>
                  <div className="text-amber-500 font-semibold uppercase bg-amber-950/20 py-0.5 px-1.5 rounded mt-1.5 text-center">
                    {sessionProfiles ? sessionProfiles.london.status : "Asian Sweep Hunt detected"}
                  </div>
                </div>
              </div>

              {/* New York Session */}
              <div className="border border-gold-900/10 bg-obsidian-900/20 p-3 rounded">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 font-bold">New York Session</span>
                  <span className="text-[9px] text-gray-500">12:00 - 20:00 UTC</span>
                </div>
                <div className="space-y-1 text-gray-400 text-[10px] pt-1">
                  <div>Session High: <span className="text-gold-500">${sessionProfiles ? sessionProfiles.newyork.high.toFixed(2) : (livePrice + 13.6).toFixed(2)}</span></div>
                  <div>Session Low: <span className="text-gold-500">${sessionProfiles ? sessionProfiles.newyork.low.toFixed(2) : (livePrice - 8.9).toFixed(2)}</span></div>
                  <div className="text-gold-500 font-semibold uppercase bg-gold-950/20 py-0.5 px-1.5 rounded mt-1.5 text-center animate-pulse">
                    {sessionProfiles ? sessionProfiles.newyork.status : "Distribution phase active"}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* news & correlation Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Macro News Sentiment */}
            <div className="glass-panel rounded-lg p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-mono font-bold text-gray-200 flex items-center gap-2 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-gold-500" /> MACRO SENTIMENT METRIC
                </h3>
                
                {sentimentSummary ? (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-obsidian-900/50 border border-gold-900/10 p-3 rounded flex flex-col items-center justify-center font-mono">
                      <span className="text-[10px] text-gray-400 uppercase">Sentiment Score</span>
                      <span className={`text-2xl font-black ${sentimentSummary.sentiment_score > 0 ? 'text-emerald-500' : sentimentSummary.sentiment_score < 0 ? 'text-red-500' : 'text-gold-500'}`}>
                        {sentimentSummary.sentiment_score > 0 ? '+' : ''}{sentimentSummary.sentiment_score}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-1 uppercase">Bias: {sentimentSummary.bias}</span>
                    </div>
                    <div className="bg-obsidian-900/50 border border-gold-900/10 p-3 rounded flex flex-col items-center justify-center font-mono text-center">
                      <span className="text-[10px] text-gray-400 uppercase">Impact Level</span>
                      <span className="text-base font-bold text-white mt-1 uppercase">{sentimentSummary.impact_level}</span>
                      <span className="text-[9px] text-gold-600 mt-1 uppercase">{sentimentSummary.market_mood}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center font-mono text-xs text-gray-500 py-6">Calculating news sentiment...</div>
                )}
              </div>

              {/* News Ticker Panel */}
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                {newsList.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="border-b border-gold-900/5 pb-2 text-[10px] font-mono last:border-0 last:pb-0">
                    <div className="flex justify-between text-gray-400 font-bold">
                      <span className="text-gold-600 uppercase">{item.source || "Feed"}</span>
                      <span>{new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-gray-200 mt-0.5 line-clamp-1">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Correlation Matrix */}
            <div className="glass-panel rounded-lg p-4 font-mono">
              <h3 className="text-xs font-mono font-bold text-gray-200 flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-gold-500" /> CORRELATION INDEX matrix
              </h3>
              {correlations ? (
                <div className="space-y-3">
                  {Object.entries(correlations).map(([sym, val]: [string, any]) => (
                    <div key={sym} className="flex flex-col gap-1 border-b border-gold-900/5 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-white">{sym} (Gold Correlation)</span>
                        <span className={`font-black ${val < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{val}</span>
                      </div>
                      <div className="w-full bg-obsidian-900 h-1.5 rounded-full overflow-hidden border border-gold-900/5">
                        <div 
                          className={`h-full rounded-full ${val < 0 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${Math.abs(val) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center font-mono text-xs text-gray-500 py-6">Loading correlations...</div>
              )}
            </div>

          </div>

        </div>

        {/* Right Section (Signals, AI Engine, SMC & Technical) - 3 Columns */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Signal Output Board */}
          <div className="glass-panel-glow rounded-lg p-5 border border-gold-500/20 relative overflow-hidden flex flex-col justify-between">
            {/* Background glowing shield */}
            <div className="absolute top-[-20px] right-[-20px] w-20 h-20 rounded-full bg-gold-500/5 blur-xl pointer-events-none" />
            
            {activeSignal ? (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gold-600 uppercase font-black tracking-widest">ACTIVE TRADING SIGNAL</span>
                  <div className="flex items-center gap-1.5">
                    {timeRemaining && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-gold-950/40 border border-gold-500/20 text-gold-500 font-black animate-pulse">
                        NEXT IN: {timeRemaining}
                      </span>
                    )}
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-gold-950/20 border border-gold-500/20 text-gold-500 font-bold uppercase">
                      XAUUSD
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`px-4 py-2 rounded text-base font-black tracking-widest font-mono text-center ${activeSignal.direction === 'BUY' ? 'bg-emerald-950/40 text-emerald-500 border border-emerald-500/30' : activeSignal.direction === 'SELL' ? 'bg-red-950/40 text-red-500 border border-red-500/30' : 'bg-obsidian-900 text-gold-500 border border-gold-500/20'}`}>
                    {activeSignal.direction}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200">Ensemble Setup</h4>
                    <span className="text-[10px] text-gray-500 font-mono">Risk Level: {activeSignal.riskLevel}</span>
                  </div>
                </div>

                {activeSignal.direction !== "BUY" && activeSignal.direction !== "SELL" ? (
                  <div className="border border-gold-500/10 bg-obsidian-950/40 p-4 rounded text-center space-y-2.5">
                    <ShieldAlert className="w-8 h-8 text-gold-500 mx-auto animate-pulse" />
                    <h5 className="text-[11px] font-mono text-gold-500 uppercase font-black tracking-wider">
                      CONFLUENCE SCANNER: WAITING
                    </h5>
                    <p className="text-[10px] font-mono text-gray-400 leading-relaxed">
                      Market confluences are weak or conflicting. Re-evaluating daily macro biases, directional trends, news, and DXY correlation maps. Avoid low-probability trades.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 border-y border-gold-900/10 py-3.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">ENTRY TRIGGER:</span>
                      <span className="text-gray-200 font-bold">${activeSignal.entry?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-500">STOP LOSS:</span>
                      <span className="text-red-400 font-bold">${activeSignal.stopLoss?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gold-900/5">
                      <span className="text-emerald-500">TAKE PROFIT 1:</span>
                      <span className="text-emerald-400 font-bold">${activeSignal.takeProfit1?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-500">TAKE PROFIT 2:</span>
                      <span className="text-emerald-400 font-bold">${activeSignal.takeProfit2?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-500">TAKE PROFIT 3:</span>
                      <span className="text-emerald-400 font-bold">${activeSignal.takeProfit3?.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Score Progress Bar */}
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">CONFLUENCE INDEX:</span>
                    <span className="text-gold-500 font-bold">{activeSignal.confidenceScore}%</span>
                  </div>
                  <div className="w-full bg-obsidian-900 h-2 rounded overflow-hidden border border-gold-900/10">
                    <div 
                      className="h-full bg-gradient-to-r from-gold-600 to-gold-400 rounded" 
                      style={{ width: `${activeSignal.confidenceScore}%` }}
                    />
                  </div>
                </div>

                {/* Confluences list */}
                <div className="space-y-1 text-[9px] font-mono text-gray-500">
                  <p className="uppercase font-bold text-gray-400">ACTIVE CONFLUENCE FACTORS:</p>
                  {activeSignal.confluences?.map((c, i) => (
                    <div key={i} className="flex justify-between">
                      <span>• {c.factor}</span>
                      <span className={c.weight >= 0 ? "text-emerald-500" : "text-red-500"}>
                        {c.weight >= 0 ? "+" : ""}{c.weight}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={saveSetup} 
                    disabled={saveStatus !== ""}
                    className="flex-1 glass-panel text-gold-500 hover:bg-gold-500 hover:text-obsidian-950 py-2 px-3 rounded font-mono text-[10px] flex items-center justify-center gap-1.5 border border-gold-500/20 hover:border-gold-500 transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saveStatus || "SAVE SETUP"}
                  </button>
                  <button className="glass-panel text-gray-400 hover:text-gold-500 py-2 px-3 rounded border border-gold-900/10 hover:border-gold-500/20 transition-all">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center font-mono text-xs text-gray-500 py-20">Computing market signals...</div>
            )}
          </div>

          {/* Multi-Timeframe Bias Map */}
          <div className="glass-panel rounded-lg p-5 space-y-3.5 font-mono text-xs">
            <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-gold-500" /> MULTI-TIMEFRAME BIAS MAP
            </h3>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
              {[
                { label: "DAILY", status: activeSignal?.timeframeAnalyses?.daily || "Neutral" },
                { label: "4H", status: activeSignal?.timeframeAnalyses?.h4 || "Neutral" },
                { label: "1H", status: activeSignal?.timeframeAnalyses?.h1 || "Neutral" },
                { label: "15M", status: activeSignal?.timeframeAnalyses?.m15 || "Neutral" },
                { label: "5M", status: activeSignal?.timeframeAnalyses?.m5 || "Neutral" }
              ].map((tf, i) => {
                const isBullish = tf.status.toLowerCase().includes("bullish");
                const isBearish = tf.status.toLowerCase().includes("bearish");
                const colorClass = isBullish 
                  ? "bg-emerald-950/30 text-emerald-500 border-emerald-500/20" 
                  : isBearish 
                  ? "bg-red-950/30 text-red-500 border-red-500/20" 
                  : "bg-obsidian-950 text-gray-500 border-gold-900/10";
                return (
                  <div key={i} className={`py-2 px-1 rounded border flex flex-col items-center justify-between min-h-[48px] ${colorClass}`}>
                    <span className="font-bold text-[8px] opacity-60">{tf.label}</span>
                    <span className="text-[8px] font-black tracking-tighter truncate w-full uppercase">
                      {isBullish ? "BUY" : isBearish ? "SELL" : "HOLD"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI prediction meters */}
          <div className="glass-panel rounded-lg p-5 space-y-4 font-mono text-xs">
            <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-gold-500" /> ENSEMBLE AI CONFIDENCE
            </h3>
            
            {techSummary && activeSignal ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                  <span className="text-gray-400">LSTM Recurrent Weight:</span>
                  <span className="text-gold-500 font-bold">
                    {activeSignal.aiPredictions 
                      ? `${(activeSignal.aiPredictions.bullish_prob * 100).toFixed(1)}% Bullish` 
                      : (activeSignal.direction === 'BUY' ? '76.2% Bullish' : activeSignal.direction === 'SELL' ? '74.1% Bearish' : 'Neutral')}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                  <span className="text-gray-400">XGBoost Classifier:</span>
                  <span className="text-gray-200 font-bold">
                    {activeSignal.aiPredictions 
                      ? `${(Math.max(activeSignal.aiPredictions.bullish_prob, activeSignal.aiPredictions.bearish_prob) * 100).toFixed(1)}% Confidence` 
                      : (activeSignal.direction === 'BUY' ? '81.4% Bullish' : activeSignal.direction === 'SELL' ? '78.5% Bearish' : 'Neutral')}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                  <span className="text-gray-400">Random Forest Weight:</span>
                  <span className="text-gray-200 font-bold">
                    {activeSignal.aiPredictions 
                      ? `${(activeSignal.aiPredictions.trend_continuation_prob * 100).toFixed(1)}% Continuity` 
                      : (activeSignal.direction === 'BUY' ? '68.9% Bullish' : activeSignal.direction === 'SELL' ? '65.2% Bearish' : 'Neutral')}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Confidence Score:</span>
                  <span className="text-emerald-500 font-bold uppercase">{activeSignal.confidenceScore}% Probability</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-10">Running ML calculations...</div>
            )}
          </div>

          {/* Technical Indicators Panel */}
          <div className="glass-panel rounded-lg p-5 space-y-4 font-mono text-xs">
            <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-gold-500" /> REAL-TIME INDICATORS
            </h3>
            
            {techSummary ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-gold-900/10 bg-obsidian-900/40 p-2.5 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">RSI (14)</div>
                  <div className="text-sm font-bold text-white mt-0.5">{techSummary.rsi?.toFixed(2)}</div>
                  <div className={`text-[9px] mt-0.5 font-bold ${techSummary.rsi > 70 ? 'text-red-400' : techSummary.rsi < 30 ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {techSummary.rsi > 70 ? 'OVERBOUGHT' : techSummary.rsi < 30 ? 'OVERSOLD' : 'NEUTRAL'}
                  </div>
                </div>

                <div className="border border-gold-900/10 bg-obsidian-900/40 p-2.5 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">MACD</div>
                  <div className="text-xs font-bold text-white mt-0.5">
                    {techSummary.macd ? `${techSummary.macd.macdLine?.toFixed(2)} / ${techSummary.macd.signalLine?.toFixed(2)}` : '0.00 / 0.00'}
                  </div>
                  <div className={`text-[9px] mt-0.5 font-bold ${techSummary.macd?.histogram > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    HIST: {techSummary.macd?.histogram > 0 ? '+' : ''}{techSummary.macd?.histogram?.toFixed(2) || '0.00'}
                  </div>
                </div>

                <div className="border border-gold-900/10 bg-obsidian-900/40 p-2.5 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">EMA (20/50/200)</div>
                  <div className="text-[10px] font-bold text-gray-200 mt-0.5">
                    EMA20: ${techSummary.ema20?.toFixed(1)}
                  </div>
                  <div className="text-[9px] text-gray-500">
                    50: ${techSummary.ema50?.toFixed(1)} | 200: ${techSummary.ema200?.toFixed(1)}
                  </div>
                </div>

                <div className="border border-gold-900/10 bg-obsidian-900/40 p-2.5 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">BOLLINGER BANDS</div>
                  <div className="text-[10px] font-bold text-gray-200 mt-0.5">
                    MID: ${techSummary.bb?.middle?.toFixed(1) || '0.00'}
                  </div>
                  <div className="text-[9px] text-gray-500">
                    UP: ${techSummary.bb?.upper?.toFixed(1) || '0.00'} | LW: ${techSummary.bb?.lower?.toFixed(1) || '0.00'}
                  </div>
                </div>

                <div className="border border-gold-900/10 bg-obsidian-900/40 p-2.5 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">ATR (14)</div>
                  <div className="text-sm font-bold text-white mt-0.5">${techSummary.atr?.toFixed(2)}</div>
                  <div className="text-[9px] text-gray-500">VOLATILITY RANGE</div>
                </div>

                <div className="border border-gold-900/10 bg-obsidian-900/40 p-2.5 rounded">
                  <div className="text-[10px] text-gray-400 uppercase">TREND CONFLUENCE</div>
                  <div className="text-sm font-bold text-white mt-0.5">{techSummary.trendScore}%</div>
                  <div className="text-[9px] text-gold-500 uppercase font-bold">{techSummary.bullishIndication?.split(' ')[0]}</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-10">Running indicator scans...</div>
            )}
          </div>

          {/* SMC Level Overlay indicators */}
          <div className="glass-panel rounded-lg p-5 space-y-4 font-mono text-xs">
            <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-gold-500" /> DETECTED ALGORITHMIC LEVELS
            </h3>

            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {activeSignal && activeSignal.smcLevels ? (
                <>
                  {/* Render Order Blocks */}
                  {activeSignal.smcLevels.order_blocks?.slice(0, 2).map((ob: any, idx: number) => (
                    <div key={`ob-${idx}`} className="p-2 border border-gold-900/10 bg-obsidian-900/40 rounded flex flex-col gap-1">
                      <div className="flex justify-between text-[10px]">
                        <span className={`${ob.type === "bullish" ? "text-emerald-500" : "text-red-400"} font-bold`}>
                          {ob.type === "bullish" ? "BULLISH ORDER BLOCK" : "BEARISH ORDER BLOCK"}
                        </span>
                        <span className="text-gray-500">{timeframe} Frame</span>
                      </div>
                      <div className="text-xs text-gray-300 font-bold">
                        ${ob.bottom?.toFixed(2)} - ${ob.top?.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {ob.mitigated ? "Mitigated block" : "Unmitigated block volume"} | Strength: {ob.strength || "High"}
                      </div>
                    </div>
                  ))}

                  {/* Render FVGs */}
                  {activeSignal.smcLevels.fvgs?.slice(0, 2).map((fvg: any, idx: number) => (
                    <div key={`fvg-${idx}`} className="p-2 border border-gold-900/10 bg-obsidian-900/40 rounded flex flex-col gap-1">
                      <div className="flex justify-between text-[10px]">
                        <span className={`${fvg.type === "bullish" ? "text-emerald-500" : "text-red-400"} font-bold`}>
                          {fvg.type === "bullish" ? "BULLISH FVG (IMBALANCE)" : "BEARISH FVG (IMBALANCE)"}
                        </span>
                        <span className="text-gray-500">{timeframe} Frame</span>
                      </div>
                      <div className="text-xs text-gray-300 font-bold">
                        ${fvg.bottom?.toFixed(2)} - ${fvg.top?.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        Imbalance zone | Status: {fvg.mitigated ? "Mitigated" : "Active"}
                      </div>
                    </div>
                  ))}

                  {/* Render Liquidity Sweeps */}
                  {activeSignal.smcLevels.liquidity_sweeps?.slice(0, 1).map((sweep: any, idx: number) => (
                    <div key={`sweep-${idx}`} className="p-2 border border-gold-900/10 bg-obsidian-900/40 rounded flex flex-col gap-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-amber-500 font-bold">LIQUIDITY SWEEP DETECTED</span>
                        <span className="text-gray-500">Recent Hunt</span>
                      </div>
                      <div className="text-xs text-gray-300 font-bold">
                        ${sweep.price_swept?.toFixed(2)} Swept
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {sweep.type === "bullish" ? "Sell Side Liquidity (SSL) Hunt" : "Buy Side Liquidity (BSL) Hunt"} complete
                      </div>
                    </div>
                  ))}

                  {/* Fallback if no levels present */}
                  {(!activeSignal.smcLevels.order_blocks?.length && !activeSignal.smcLevels.fvgs?.length) && (
                    <div className="text-center text-gray-500 py-4">Scanning structure...</div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-500 py-4">Loading structure maps...</div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
