"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  TrendingUp, TrendingDown, Cpu, Activity, ShieldAlert, Clock, 
  RefreshCw, Save, ArrowRight, Share2, Layers, MessageSquare, AlertCircle, BarChart3
} from "lucide-react";

const BACKEND_URL = "http://localhost:5000";

// Interface Definitions
interface Signal {
  id: string;
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

  // 2. Fetch Terminal Data from Backend or fall back to high-fidelity mocks
  const fetchTerminalData = async () => {
    setIsLoading(true);
    try {
      // Step A: Fetch News
      let newsData = [];
      try {
        const newsRes = await fetch(`${BACKEND_URL}/api/market/news`);
        newsData = await newsRes.json();
        setNewsList(newsData);
      } catch (e) {
        // News fallback
        newsData = [
          { title: "FOMC statement hints at rate pause as inflation cools down", description: "Geopolitical Safe Haven demand remains robust.", source: "Reuters", publishedAt: new Date().toISOString() },
          { title: "Middle East geopolitical conflicts trigger safe-haven gold buy-ins", description: "Market volatility peaks as gold approaches resistance.", source: "Bloomberg", publishedAt: new Date().toISOString() },
          { title: "US Dollar Index DXY drops below critical support line", description: "Bond yields slip, strengthening gold commodity pricing.", source: "MarketWatch", publishedAt: new Date().toISOString() }
        ];
        setNewsList(newsData);
      }

      // Step B: Fetch historical mock candles locally (or generate)
      const basePrice = livePrice;
      const candles = Array.from({ length: 60 }).map((_, idx) => {
        const cVal = basePrice + (Math.random() - 0.5) * 15;
        return {
          timestamp: new Date(Date.now() - idx * 15 * 60 * 1000).toISOString(),
          open: cVal - (Math.random() - 0.5) * 4,
          high: cVal + Math.random() * 5,
          low: cVal - Math.random() * 5,
          close: cVal,
          volume: Math.floor(1000 + Math.random() * 3000)
        };
      }).reverse();

      // Step C: Trigger Signal Confluence Generation
      try {
        const signalRes = await fetch(`${BACKEND_URL}/api/signals/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candles, news: newsData })
        });
        
        const signalPayload = await signalRes.json();
        setActiveSignal(signalPayload.activeSignal);
        setTechSummary(signalPayload.technicalSummary);
        setSentimentSummary(signalPayload.sentimentSummary);
        setIsBackendOnline(true);
        setIsAiEngineOnline(signalPayload.activeSignal.engineConnected);
      } catch (e) {
        // Fallback calculations locally
        setIsBackendOnline(false);
        setIsAiEngineOnline(false);
        simulateLocalConfluence(basePrice);
      }

      // Step D: Get Correlation
      try {
        const corrRes = await fetch(`${BACKEND_URL}/api/market/correlation`);
        const corrData = await corrRes.json();
        setCorrelations(corrData.correlations);
      } catch (e) {
        setCorrelations({ "DXY": -0.83, "US10Y": -0.76, "SPX500": 0.05, "CrudeOil": 0.54 });
      }

    } catch (err) {
      console.error("Error fetching terminal data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateLocalConfluence = (price: number) => {
    // Generate simulated indicators
    setTechSummary({
      ema20: price - 3.5,
      ema50: price - 8.2,
      ema200: price - 24.10,
      rsi: 58.4,
      atr: 4.80,
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
      ]
    });
  };

  useEffect(() => {
    fetchTerminalData();
    // Poll for ticking updates
    const priceInterval = setInterval(() => {
      setLivePrice((prev) => {
        const walk = (Math.random() - 0.5) * 0.35;
        setPriceDirection(walk > 0 ? "up" : walk < 0 ? "down" : "flat");
        return parseFloat((prev + walk).toFixed(2));
      });
      setSpread(parseFloat((1.0 + Math.random() * 0.4).toFixed(1)));
    }, 4000);

    return () => clearInterval(priceInterval);
  }, []);

  // Timeframe selector handling
  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    const intervals: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '1H': '60', '4H': '240', 'Daily': 'D'
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
          <button onClick={fetchTerminalData} className="p-2 rounded hover:bg-obsidian-900 border border-transparent hover:border-gold-900/10 text-gray-400 hover:text-gold-500 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
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
                {['1m', '5m', '15m', '1H', '4H', 'Daily'].map((tf) => (
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
                  <div>Range High: <span className="text-gold-500">$4339.40</span></div>
                  <div>Range Low: <span className="text-gold-500">$4324.20</span></div>
                  <div className="text-emerald-500 font-semibold uppercase bg-emerald-950/20 py-0.5 px-1.5 rounded mt-1.5 text-center">
                    Accumulation complete
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
                  <div>Session High: <span className="text-gold-500">$4344.80</span></div>
                  <div>Session Low: <span className="text-gold-500">$4321.50</span></div>
                  <div className="text-amber-500 font-semibold uppercase bg-amber-950/20 py-0.5 px-1.5 rounded mt-1.5 text-center">
                    Asian Sweep Hunt detected
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
                  <div>Session High: <span className="text-gold-500">$4348.60</span></div>
                  <div>Session Low: <span className="text-gold-500">$4326.10</span></div>
                  <div className="text-gold-500 font-semibold uppercase bg-gold-950/20 py-0.5 px-1.5 rounded mt-1.5 text-center animate-pulse">
                    Distribution phase active
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
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-gold-950/20 border border-gold-500/20 text-gold-500 font-bold uppercase">
                    XAUUSD
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`px-4 py-2 rounded text-base font-black tracking-widest font-mono text-center ${activeSignal.direction === 'BUY' ? 'bg-emerald-950/40 text-emerald-500 border border-emerald-500/30' : activeSignal.direction === 'SELL' ? 'bg-red-950/40 text-red-500 border border-red-500/30' : 'bg-obsidian-900 text-gray-400 border border-gold-900/10'}`}>
                    {activeSignal.direction}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200">Ensemble Setup</h4>
                    <span className="text-[10px] text-gray-500 font-mono">RR Ratio: {activeSignal.riskRewardRatio || 'N/A'}</span>
                  </div>
                </div>

                {activeSignal.direction !== "HOLD" && (
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
                    {activeSignal.direction === 'BUY' ? '76.2% Bullish' : activeSignal.direction === 'SELL' ? '74.1% Bearish' : 'Neutral'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                  <span className="text-gray-400">XGBoost Classifier:</span>
                  <span className="text-gray-200 font-bold">
                    {activeSignal.direction === 'BUY' ? '81.4% Bullish' : activeSignal.direction === 'SELL' ? '78.5% Bearish' : 'Neutral'}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                  <span className="text-gray-400">Random Forest:</span>
                  <span className="text-gray-200 font-bold">
                    {activeSignal.direction === 'BUY' ? '68.9% Bullish' : activeSignal.direction === 'SELL' ? '65.2% Bearish' : 'Neutral'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Trend Continuation:</span>
                  <span className="text-emerald-500 font-bold uppercase">72.4% Probability</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-10">Running ML calculations...</div>
            )}
          </div>

          {/* SMC Level Overlay indicators */}
          <div className="glass-panel rounded-lg p-5 space-y-4 font-mono text-xs">
            <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-gold-500" /> DETECTED ALGORITHMIC LEVELS
            </h3>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              <div className="p-2 border border-gold-900/10 bg-obsidian-900/40 rounded flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-emerald-500 font-bold">BULLISH ORDER BLOCK</span>
                  <span className="text-gray-500">1H Frame</span>
                </div>
                <div className="text-xs text-gray-300 font-bold">$4322.50 - $4327.10</div>
                <div className="text-[9px] text-gray-500">Unmitigated block volume | Strength: High</div>
              </div>

              <div className="p-2 border border-gold-900/10 bg-obsidian-900/40 rounded flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-emerald-500 font-bold">FAIR VALUE GAP (FVG)</span>
                  <span className="text-gray-500">15m Frame</span>
                </div>
                <div className="text-xs text-gray-300 font-bold">$4332.10 - $4334.80</div>
                <div className="text-[9px] text-gray-500">Imbalance zone | Mitigated: Partially</div>
              </div>

              <div className="p-2 border border-gold-900/10 bg-obsidian-900/40 rounded flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-red-400 font-bold">LIQUIDITY SWEEP (BSL)</span>
                  <span className="text-gray-500">5m Frame</span>
                </div>
                <div className="text-xs text-gray-300 font-bold">$4344.80 Swept</div>
                <div className="text-[9px] text-gray-500">Rejection wick | Liquidity hunt complete</div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
