"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, ShieldAlert, Cpu, Activity, ArrowRight, Layers, BarChart3, Globe } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const [livePrice, setLivePrice] = useState(4335.50);
  const [marketVolatility, setMarketVolatility] = useState("Medium");
  const [fearGreedIndex, setFearGreedIndex] = useState(64);

  // Dynamic ticking values to give a "live" feel
  useEffect(() => {
    const interval = setInterval(() => {
      setLivePrice((prev) => parseFloat((prev + (Math.random() - 0.5) * 0.4).toFixed(2)));
      if (Math.random() > 0.8) {
        setMarketVolatility((prev) => (prev === "Medium" ? (Math.random() > 0.5 ? "High" : "Low") : "Medium"));
      }
      if (Math.random() > 0.7) {
        setFearGreedIndex((prev) => Math.min(95, Math.max(10, prev + Math.floor((Math.random() - 0.5) * 3))));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Cpu className="w-6 h-6 text-gold-500" />,
      title: "High-Probability AI Forecasts",
      description: "Ensemble model blending local online-fit Random Forests, XGBoost regressors, and simulated LSTM recurrent cells for gold price forecasts."
    },
    {
      icon: <Layers className="w-6 h-6 text-gold-500" />,
      title: "Smart Money Concepts (SMC)",
      description: "Algorithmic scans identifying unmitigated Order Blocks, Fair Value Gaps (FVG), swing break structures (BOS/CHoCH), and liquidity sweep levels."
    },
    {
      icon: <Globe className="w-6 h-6 text-gold-500" />,
      title: "Macro News Sentiment Analyzer",
      description: "Gold-specific NLP processing of geopolitical risks, inflation metrics (CPI/PCE), Fed declarations (FOMC), and job data (NFP)."
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-gold-500" />,
      title: "Institutional Confidence Scoring",
      description: "Multi-confluence weights compiling higher timeframe trend, news momentum, order flow imbalance, and indicators into a single score."
    }
  ];

  return (
    <div className="relative min-h-screen flex flex-col bg-obsidian-950 animated-grid overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-gold-950/10 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gold-950/5 blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-gold-900/10 py-4 px-6 md:px-12 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-300 via-gold-500 to-gold-700 flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.4)]">
            <span className="font-mono font-black text-obsidian-950 text-xl tracking-tighter">AX</span>
          </div>
          <div>
            <h1 className="font-mono font-bold text-lg leading-none tracking-wider text-gray-100">AURAX <span className="text-gold-500">AI</span></h1>
            <p className="text-[10px] uppercase font-mono tracking-widest text-gold-600">Institutional Intelligence</p>
          </div>
        </Link>
        <nav className="hidden md:flex gap-8 items-center text-sm font-mono text-gray-400">
          <Link href="/terminal" className="hover:text-gold-500 transition-colors">Terminal</Link>
          <Link href="/dashboard" className="hover:text-gold-500 transition-colors">Dashboard</Link>
          <Link href="/admin" className="hover:text-gold-500 transition-colors">Admin Panel</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/terminal" className="glass-panel text-gold-500 hover:bg-gold-500 hover:text-obsidian-950 font-mono text-xs py-2 px-4 rounded border border-gold-500/30 transition-all gold-glow-hover">
            Enter Terminal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-24 flex flex-col items-center justify-center relative z-10">
        
        {/* Ticker Row */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-12 py-2 px-6 glass-panel rounded-full text-xs font-mono text-gray-300 items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold-500 animate-neon-pulse" />
            <span>XAU/USD:</span>
            <span className="text-gold-500 font-bold">${livePrice.toFixed(2)}</span>
          </div>
          <div className="h-4 w-px bg-gold-900/20 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-gold-500" />
            <span>Volatility:</span>
            <span className="text-gray-100 font-bold">{marketVolatility}</span>
          </div>
          <div className="h-4 w-px bg-gold-900/20 hidden sm:block" />
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-gold-500" />
            <span>Sentiment Mood:</span>
            <span className="text-gold-400 font-bold">{fearGreedIndex} (Risk-Off)</span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h2 className="text-4xl md:text-7xl font-sans font-black tracking-tight text-white leading-[1.1]">
            AI-Powered Institutional <br/>
            <span className="gold-gradient-text">Gold Intelligence</span>
          </h2>
          
          <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto font-sans leading-relaxed">
            Advanced multi-confluence XAUUSD analysis powered by machine learning, Smart Money Concepts, and real-time market sentiment intelligence. Built for professional trade planning.
          </p>
        </div>

        {/* Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-10 w-full sm:w-auto justify-center">
          <Link href="/terminal" className="bg-gradient-to-r from-gold-400 to-gold-600 text-obsidian-950 font-bold py-4 px-8 rounded shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all flex items-center justify-center gap-2 group">
            Start Analysis <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/terminal" className="glass-panel text-gray-200 hover:text-white py-4 px-8 rounded border border-gray-800 hover:border-gold-500/30 transition-all flex items-center justify-center gap-2">
            View Live Signals
          </Link>
          <Link href="/dashboard" className="glass-panel text-gold-500 hover:text-gold-400 py-4 px-8 rounded border border-gold-500/20 hover:border-gold-500/40 transition-all flex items-center justify-center gap-2">
            Join Premium
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mt-24">
          {features.map((feat, idx) => (
            <div key={idx} className="glass-panel rounded-lg p-6 flex flex-col justify-between hover:border-gold-500/30 gold-glow-hover group transition-all">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-gold-950/20 border border-gold-900/10 flex items-center justify-center group-hover:border-gold-500/30 transition-colors">
                  {feat.icon}
                </div>
                <h3 className="font-sans font-bold text-gray-100 text-lg">{feat.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feat.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dynamic Analytics Teaser Section */}
        <div className="w-full mt-20 p-8 glass-panel-glow rounded-xl flex flex-col lg:flex-row items-center gap-8 border border-gold-500/10">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 py-1 px-3 rounded-full bg-gold-950/30 border border-gold-500/20 text-gold-500 font-mono text-[10px] uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" /> High Probability Strategy
            </div>
            <h3 className="text-2xl md:text-3xl font-sans font-extrabold text-white">
              Institutional Risk Management Matrix
            </h3>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed">
              No guarantees, only statistical confluences. Aurax compiles order blocks, news sentiment wicks, and automated machine learning parameters to forecast gold market trends. Plan trades with precise target intervals.
            </p>
            <div className="flex gap-6 font-mono text-xs text-gray-400 pt-2">
              <div>
                <span className="block text-2xl font-bold text-gold-500">84%</span>
                Confluence Weight Limit
              </div>
              <div className="w-px bg-gold-900/20" />
              <div>
                <span className="block text-2xl font-bold text-gold-500">100%</span>
                Institutional Architecture
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-96 h-48 border border-gold-900/15 bg-obsidian-900/80 rounded-lg p-4 flex flex-col justify-between font-mono text-xs text-gray-400">
            <div className="flex justify-between items-center border-b border-gold-900/10 pb-2">
              <span className="text-gold-500 font-bold">XAUUSD SIMULATION</span>
              <span className="animate-neon-pulse px-2 py-0.5 rounded bg-gold-950/20 border border-gold-500/30 text-[9px] text-gold-500">LIVE FEED</span>
            </div>
            <div className="space-y-1.5 flex-1 pt-3">
              <div className="flex justify-between">
                <span>Ensemble Confidence:</span>
                <span className="text-gold-400">78%</span>
              </div>
              <div className="flex justify-between">
                <span>LSTM Recurrent Weight:</span>
                <span className="text-gray-200">Bullish bias</span>
              </div>
              <div className="flex justify-between">
                <span>Unmitigated Demand OB:</span>
                <span className="text-gold-600 font-bold">$4310.00 - $4320.00</span>
              </div>
              <div className="flex justify-between">
                <span>DXY Correlation:</span>
                <span className="text-red-500">-0.81 (Highly Negative)</span>
              </div>
            </div>
            <div className="flex justify-center border-t border-gold-900/10 pt-2">
              <Link href="/terminal" className="text-[11px] text-gold-500 hover:text-gold-400 flex items-center gap-1.5 hover:underline">
                Unlock full platform data <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="glass-panel border-t border-gold-900/10 py-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-gray-500">
        <div>
          <p>© {new Date().getFullYear()} AURAX AI. All rights reserved.</p>
          <p className="text-[10px] text-gray-600 mt-1">Institutional-grade gold trading intelligence platform.</p>
        </div>
        <div className="text-center md:text-right max-w-md">
          <p className="text-[10px] text-red-500/60 leading-normal uppercase">
            Risk Disclosure: Gold trading (XAUUSD) carries high risk. AI-generated analyses represent high-probability models, not guaranteed profit rates or risk-free signals. Always apply proper risk management.
          </p>
        </div>
      </footer>
    </div>
  );
}
