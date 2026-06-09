"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User, Bookmark, Bell, Shield, ArrowLeft, Trash2, Plus, LogOut, CheckCircle } from "lucide-react";

const BACKEND_URL = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/_/backend"
  : "http://localhost:5000";

export default function DashboardPage() {
  const [savedSetups, setSavedSetups] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>(["XAUUSD", "DXY", "US10Y"]);
  const [newSymbol, setNewSymbol] = useState<string>("");
  const [userProfile, setUserProfile] = useState<any>({
    fullName: "Premium Trader",
    email: "demo@aurax.ai",
    subscription: "Elite Institutional",
    joinedDate: "2026-01-15"
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch setups and watchlists
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch setups
      const setupRes = await fetch(`${BACKEND_URL}/api/auth/setups`);
      if (setupRes.ok) {
        const setupsData = await setupRes.json();
        setSavedSetups(setupsData);
      }
      
      // Fetch watchlist
      const watchRes = await fetch(`${BACKEND_URL}/api/auth/watchlist?email=${userProfile.email}`);
      if (watchRes.ok) {
        const watchData = await watchRes.json();
        setWatchlist(watchData);
      }
    } catch (e) {
      console.warn("Unable to fetch data from backend. Falling back to local offline dashboard values.");
      // Seed fallback values
      setSavedSetups([
        {
          id: "SAV_MOCK1",
          symbol: "XAUUSD",
          direction: "BUY",
          entry: 4335.50,
          stopLoss: 4315.00,
          takeProfit1: 4360.00,
          takeProfit2: 4380.00,
          confidenceScore: 78,
          timeframe: "15m",
          savedAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Delete saved setup
  const deleteSetup = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/setups/${id}`, { method: "DELETE" });
      setSavedSetups((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setSavedSetups((prev) => prev.filter((s) => s.id !== id));
    }
  };

  // Add symbol to watchlist
  const addWatchlistSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol) return;
    const cleanSym = newSymbol.toUpperCase().replace("/", "");
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userProfile.email, symbol: cleanSym })
      });
      const data = await res.json();
      setWatchlist(data);
    } catch (err) {
      if (!watchlist.includes(cleanSym)) {
        setWatchlist((prev) => [...prev, cleanSym]);
      }
    }
    setNewSymbol("");
  };

  // Remove symbol from watchlist
  const removeWatchlistSymbol = async (symbol: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/watchlist`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userProfile.email, symbol })
      });
      const data = await res.json();
      setWatchlist(data);
    } catch (err) {
      setWatchlist((prev) => prev.filter((item) => item !== symbol));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 font-sans text-gray-100">
      
      {/* Header */}
      <header className="glass-panel border-b border-gold-900/10 py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/terminal" className="flex items-center gap-2 text-gray-400 hover:text-gold-500 mr-2 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-300 via-gold-500 to-gold-700 flex items-center justify-center">
            <span className="font-mono font-black text-obsidian-950 text-base tracking-tighter">AX</span>
          </div>
          <h1 className="font-mono font-bold text-sm tracking-wider text-white">AURAX <span className="text-gold-500">DASHBOARD</span></h1>
        </div>
        <nav className="flex items-center gap-4 text-xs font-mono">
          <Link href="/terminal" className="text-gray-400 hover:text-gold-500 transition-colors">Terminal</Link>
          <Link href="/admin" className="text-gray-400 hover:text-gold-500 transition-colors">Admin Panel</Link>
          <Link href="/" className="text-red-500 hover:text-red-400 flex items-center gap-1.5 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </Link>
        </nav>
      </header>

      {/* Workspace Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: profile card and subscription - 4 columns */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* User Profile Card */}
          <div className="glass-panel rounded-lg p-6 font-mono border border-gold-900/10 relative overflow-hidden">
            <div className="absolute top-[-20px] left-[-20px] w-24 h-24 rounded-full bg-gold-500/5 blur-2xl pointer-events-none" />
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-obsidian-800 border border-gold-500/30 flex items-center justify-center">
                <User className="w-8 h-8 text-gold-500" />
              </div>
              <div className="leading-tight">
                <h3 className="text-base font-bold text-white">{userProfile.fullName}</h3>
                <span className="text-[10px] text-gray-500">{userProfile.email}</span>
              </div>
              
              <div className="w-full h-px bg-gold-900/10 my-2" />
              
              <div className="w-full text-left space-y-2 text-[11px] text-gray-400">
                <div className="flex justify-between">
                  <span>Membership:</span>
                  <span className="text-gold-500 font-bold">{userProfile.subscription}</span>
                </div>
                <div className="flex justify-between">
                  <span>Member Since:</span>
                  <span className="text-gray-200">{userProfile.joinedDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Subscription Details */}
          <div className="glass-panel-glow rounded-lg p-6 border border-gold-500/20 space-y-4 font-mono">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold-500" /> INSTITUTIONAL PASS
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your account is active on the Elite Institutional tier. You have unlimited real-time access to the AI Ensemble models and SMC levels.
            </p>
            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Unlimited Twelve Data Calls</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>LSTM/XGBoost Confluences Enabled</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Priority Push & Email Alerts</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right column: watchlists & saved setups - 8 columns */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Saved Trade Setups */}
          <div className="glass-panel rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2 border-b border-gold-900/10 pb-3">
              <Bookmark className="w-4 h-4 text-gold-500" /> SAVED TRADING SETUPS
            </h3>

            {isLoading ? (
              <div className="text-center font-mono text-xs text-gray-500 py-10">Fetching setups...</div>
            ) : savedSetups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedSetups.map((setup) => (
                  <div key={setup.id} className="border border-gold-900/10 bg-obsidian-900/50 p-4 rounded-lg font-mono text-xs flex flex-col justify-between hover:border-gold-500/20 transition-all">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${setup.direction === 'BUY' ? 'bg-emerald-950/40 text-emerald-500 border border-emerald-500/20' : 'bg-red-950/40 text-red-500 border border-red-500/20'}`}>
                          {setup.direction}
                        </span>
                        <button 
                          onClick={() => deleteSetup(setup.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 text-gray-400">
                        <div className="flex justify-between">
                          <span>Pair / Frame:</span>
                          <span className="text-white font-bold">{setup.symbol} ({setup.timeframe})</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Entry Trigger:</span>
                          <span className="text-gray-200">${setup.entry?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stop Loss:</span>
                          <span className="text-red-400">${setup.stopLoss?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Take Profit 1:</span>
                          <span className="text-emerald-400">${setup.takeProfit1?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-gold-900/5 flex justify-between items-center text-[10px]">
                      <span className="text-gold-500 font-bold">Confidence: {setup.confidenceScore}%</span>
                      <span className="text-gray-600">{new Date(setup.savedAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center font-mono text-xs text-gray-500 py-10 border border-dashed border-gold-900/10 rounded-lg">
                No saved setups detected. Save a confluence plan inside the Live Terminal to track it here.
              </div>
            )}
          </div>

          {/* Watchlists */}
          <div className="glass-panel rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2 border-b border-gold-900/10 pb-3">
              <Bell className="w-4 h-4 text-gold-500" /> REAL-TIME WATCHLIST
            </h3>

            <form onSubmit={addWatchlistSymbol} className="flex gap-2 font-mono">
              <input 
                type="text" 
                placeholder="ADD SYMBOL (e.g. SPX500, EURUSD)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="flex-1 bg-obsidian-900 border border-gold-900/15 rounded py-2 px-3 text-xs text-white focus:outline-none focus:border-gold-500 transition-colors uppercase"
              />
              <button type="submit" className="bg-gold-500 text-obsidian-950 font-bold py-2 px-4 rounded hover:bg-gold-400 transition-all text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> ADD
              </button>
            </form>

            <div className="border border-gold-900/10 rounded overflow-hidden">
              <table className="w-full font-mono text-xs text-left">
                <thead className="bg-obsidian-900/80 text-gray-400 border-b border-gold-900/10">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Symbol</th>
                    <th className="py-2.5 px-4 font-bold">Asset Type</th>
                    <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-900/5">
                  {watchlist.map((symbol) => (
                    <tr key={symbol} className="hover:bg-obsidian-900/30 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-white uppercase">{symbol}</td>
                      <td className="py-2.5 px-4 text-gray-400 text-[10px]">
                        {symbol === 'XAUUSD' ? 'Commodity (Gold)' : symbol === 'DXY' ? 'USD Index' : symbol === 'US10Y' ? 'US Yield' : 'Currency/Index'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button 
                          onClick={() => removeWatchlistSymbol(symbol)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
