"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Settings, Server, RefreshCw, Send, ArrowLeft, CheckCircle, AlertTriangle, Play } from "lucide-react";

const BACKEND_URL = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "/_/backend"
  : "http://localhost:5000";

export default function AdminPage() {
  const [isSending, setIsSending] = useState<boolean>(false);
  const [alertForm, setAlertForm] = useState({
    type: "Liquidity Sweep",
    message: "Bullish liquidity sweep (SSL) detected at $4332.40 on 1H chart. Target reversal imminent.",
    confidence: 85
  });

  const [apiStatus, setApiStatus] = useState<any>({
    proxy: "Checking...",
    aiEngine: "Checking...",
    twelvedata: "Configured",
    alphaVantage: "Configured",
    finnhub: "Configured",
    newsApi: "Configured",
    supabase: "Configured"
  });

  const [alertLogs, setAlertLogs] = useState<any[]>([]);
  const [dispatchResult, setDispatchResult] = useState<string>("");

  // Fetch status and alert history
  const fetchAdminData = async () => {
    try {
      const healthRes = await fetch(`${BACKEND_URL}/health`);
      if (healthRes.ok) {
        const health = await healthRes.json();
        setApiStatus({
          proxy: "Active",
          aiEngine: "Connected",
          twelvedata: health.env.twelvedataConfigured ? "Active" : "Not configured",
          alphaVantage: "Active",
          finnhub: "Active",
          newsApi: health.env.newsApiConfigured ? "Active" : "Not configured",
          supabase: health.env.supabaseConfigured ? "Active" : "Not configured"
        });
      }
    } catch (e) {
      setApiStatus({
        proxy: "Fallback Mode (Server Offline)",
        aiEngine: "Offline",
        twelvedata: "Simulating",
        alphaVantage: "Simulating",
        finnhub: "Simulating",
        newsApi: "Simulating",
        supabase: "Simulating"
      });
    }

    try {
      const alertHistoryRes = await fetch(`${BACKEND_URL}/api/alerts/history`);
      if (alertHistoryRes.ok) {
        const history = await alertHistoryRes.json();
        setAlertLogs(history);
      }
    } catch (e) {
      // seed fallback history
      setAlertLogs([
        { id: "ALT_M1", timestamp: new Date().toISOString(), type: "Liquidity Sweep", message: "Mock: Bearish Sweep (BSL) swept $4344.50. Rejecting downwards.", confidence: 80 }
      ]);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Form handle changes
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    let message = "";
    if (type === "Liquidity Sweep") {
      message = "Bullish liquidity sweep (SSL) detected at $4332.40 on 1H chart. Target reversal imminent.";
    } else if (type === "High Confidence Setup") {
      message = "High Confidence BUY Setup detected at $4335.10 with 5 indicators aligned (RSI, EMA, SMC, VADER).";
    } else if (type === "Strong News Impact") {
      message = "High Impact CPI release: Core CPI rises 0.1% below expectations. Gold price surging upward.";
    } else if (type === "Trend Reversal") {
      message = "Change of Character (CHoCH) structure shift confirmed on 4H Gold chart. Reversal trend active.";
    }
    setAlertForm({ ...alertForm, type, message });
  };

  // Dispatch alert simulation
  const dispatchAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setDispatchResult("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/alerts/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertForm)
      });
      const data = await res.json();
      if (data.success) {
        setDispatchResult(`Success! Dispatched to channels: ${data.dispatchChannels.join(", ")}`);
        setAlertLogs((prev) => [data.dispatchedAlert, ...prev]);
      }
    } catch (e) {
      // local offline simulation
      const simulatedAlert = {
        id: "ALT_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        timestamp: new Date().toISOString(),
        type: alertForm.type,
        message: alertForm.message + " (Simulated local dispatch)",
        confidence: alertForm.confidence
      };
      setAlertLogs((prev) => [simulatedAlert, ...prev]);
      setDispatchResult("Success! Simulated local alert (Backend Offline).");
    } finally {
      setIsSending(false);
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
          <h1 className="font-mono font-bold text-sm tracking-wider text-white">AURAX <span className="text-gold-500">ADMIN PANEL</span></h1>
        </div>
        <nav className="flex items-center gap-4 text-xs font-mono">
          <button onClick={fetchAdminData} className="p-2 rounded hover:bg-obsidian-900 text-gray-400 hover:text-gold-500 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/terminal" className="text-gray-400 hover:text-gold-500 transition-colors">Terminal</Link>
          <Link href="/dashboard" className="text-gray-400 hover:text-gold-500 transition-colors">Dashboard</Link>
        </nav>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Server Status Telemetry - 5 columns */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Telemetry Status Box */}
          <div className="glass-panel rounded-lg p-6 font-mono space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gold-900/10 pb-3">
              <Server className="w-4 h-4 text-gold-500" /> SYSTEM TELEMETRY
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                <span>Express Server status:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${apiStatus.proxy.includes('Active') ? 'text-emerald-500 bg-emerald-950/20' : 'text-amber-500 bg-amber-950/20'}`}>
                  {apiStatus.proxy}
                </span>
              </div>
              
              <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                <span>FastAPI AI status:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${apiStatus.aiEngine === 'Connected' ? 'text-emerald-500 bg-emerald-950/20' : 'text-red-500 bg-red-950/20'}`}>
                  {apiStatus.aiEngine}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                <span>Twelve Data API status:</span>
                <span className="text-gold-500 font-bold">{apiStatus.twelvedata}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                <span>Alpha Vantage status:</span>
                <span className="text-gold-500 font-bold">{apiStatus.alphaVantage}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                <span>Finnhub API key status:</span>
                <span className="text-gold-500 font-bold">{apiStatus.finnhub}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gold-900/5 pb-2">
                <span>NewsAPI key status:</span>
                <span className="text-gold-500 font-bold">{apiStatus.newsApi}</span>
              </div>

              <div className="flex justify-between items-center">
                <span>Supabase DB status:</span>
                <span className="text-gold-500 font-bold">{apiStatus.supabase}</span>
              </div>
            </div>
          </div>

          {/* AI engine models info */}
          <div className="glass-panel rounded-lg p-6 font-mono space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gold-900/10 pb-3">
              <Settings className="w-4 h-4 text-gold-500" /> AI ENGINE telemetry
            </h3>
            
            <div className="space-y-3 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <span className="text-white font-bold block">LSTM Recurrent Model:</span>
                  Runs mathematical recurrent gates over 10-bar sequences.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <span className="text-white font-bold block">XGBoost Classifier:</span>
                  Online fit model trained on historical volatility factors.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <span className="text-white font-bold block">Random Forest Classifier:</span>
                  50-tree scikit-learn estimator predicting directional shifts.
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right column: Alert Simulation & Logs - 7 columns */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Dispatch simulation form */}
          <div className="glass-panel-glow rounded-lg p-6 border border-gold-500/20 space-y-4">
            <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2 border-b border-gold-900/10 pb-3">
              <Send className="w-4 h-4 text-gold-500" /> ALERT SIMULATION CONSOLE
            </h3>

            <form onSubmit={dispatchAlert} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase">Alert Classification</label>
                  <select 
                    value={alertForm.type}
                    onChange={handleTypeChange}
                    className="w-full bg-obsidian-900 border border-gold-900/15 rounded py-2 px-3 focus:outline-none focus:border-gold-500 text-white cursor-pointer"
                  >
                    <option value="Liquidity Sweep">Liquidity Sweep</option>
                    <option value="High Confidence Setup">High Confidence Setup</option>
                    <option value="Strong News Impact">Strong News Impact</option>
                    <option value="Trend Reversal">Trend Reversal</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase">Confidence Meter (%)</label>
                  <input 
                    type="number"
                    min="50"
                    max="95"
                    value={alertForm.confidence}
                    onChange={(e) => setAlertForm({ ...alertForm, confidence: parseInt(e.target.value) || 50 })}
                    className="w-full bg-obsidian-900 border border-gold-900/15 rounded py-2 px-3 focus:outline-none focus:border-gold-500 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase">Alert Message Text</label>
                <textarea 
                  rows={3}
                  value={alertForm.message}
                  onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                  className="w-full bg-obsidian-900 border border-gold-900/15 rounded py-2 px-3 focus:outline-none focus:border-gold-500 text-white resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSending}
                className="w-full bg-gold-500 text-obsidian-950 font-bold py-3 rounded hover:bg-gold-400 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isSending ? "DISPATCHING..." : "DISPATCH SIMULATED SIGNAL"}
              </button>
            </form>

            {dispatchResult && (
              <div className="p-3 bg-gold-950/20 border border-gold-500/20 rounded font-mono text-[11px] text-gold-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{dispatchResult}</span>
              </div>
            )}
          </div>

          {/* Alert logs list */}
          <div className="glass-panel rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2 border-b border-gold-900/10 pb-3">
              <Shield className="w-4 h-4 text-gold-500" /> DISPATCHED ALERT LOGS (LAST 10)
            </h3>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {alertLogs.map((log) => (
                <div key={log.id} className="border border-gold-900/10 bg-obsidian-900/30 p-3.5 rounded font-mono text-xs space-y-1.5 hover:border-gold-500/10 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-gold-500 font-bold uppercase">{log.type}</span>
                    <span className="text-[10px] text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-gray-300 leading-normal">{log.message}</p>
                  <div className="flex justify-between text-[10px] text-gray-500 pt-1 border-t border-gold-900/5">
                    <span>ID: {log.id}</span>
                    <span className="text-gold-600 font-bold">Confidence: {log.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
