'use client';

import React, { useEffect, useState } from 'react';
import TradingChart from '@/components/TradingChart';
import StrategyAnalysisPanel from '@/components/StrategyAnalysisPanel';
import AgentTerminal from '@/components/AgentTerminal';
import { RefreshCw, Zap, Activity, XCircle, AlertTriangle } from 'lucide-react';

interface AgentStats {
  balance: number;
  wallet_value: number;
  floating_pnl: number;
  open_positions: number;
  total_closed_trades: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
  circuit_breaker_active: boolean;
}

interface Trade {
  id: string;
  symbol: string;
  direction?: string;
  leverage?: number;
  liquidation_price?: number;
  quoted_price?: number;
  entry_price: number;
  exit_price?: number;
  slippage_pct?: number;
  fee_usd?: number;
  exit_fee_usd?: number;
  amount_usd: number;
  notional_usd?: number;
  pnl?: number;
  confidence: number;
  status: string;
}

export default function Home() {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [historyTrades, setHistoryTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [actorKey, setActorKey] = useState('');
  const [researcherKey, setResearcherKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [keysSaved, setKeysSaved] = useState(false);

  // Determine dynamic base URLs for the backend API and WS
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

  const fetchState = async () => {
    try {
      const statsRes = await fetch(`${baseUrl}/api/stats`);
      const statsData = await statsRes.json();
      setStats(statsData);

      const tradesRes = await fetch(`${baseUrl}/api/trades`);
      const tradesData = await tradesRes.json();
      setActiveTrades(tradesData.active);
      setHistoryTrades(tradesData.history.reverse()); // Newest closed first
    } catch (err) {
      console.error("Failed to fetch state:", err);
    }
  };

  // Connect to the state WebSocket
  useEffect(() => {
    // Perform an initial fetch to populate UI instantly
    fetchState();

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let isComponentMounted = true;
    let reconnectAttempt = 0;
    const baseDelayMs = 1000;
    const maxDelayMs = 10000;

    const connectWebSocket = () => {
      ws = new WebSocket(`${baseWsUrl}/ws/state`);

      ws.onopen = () => {
        reconnectAttempt = 0; // Reset on successful connect
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.stats) {
            setStats(payload.stats);
          }
          if (payload.trades) {
            setActiveTrades(payload.trades.active);
            setHistoryTrades(payload.trades.history.reverse());
          }
        } catch (err) {
          console.error("Failed to parse state WS message:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("State WebSocket error:", error);
      };

      ws.onclose = () => {
        if (isComponentMounted) {
          const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, reconnectAttempt));
          const jitter = Math.random() * baseDelayMs; // Add jitter
          const totalDelay = delay + jitter;
          console.log(`State WebSocket closed, attempting to reconnect in ${totalDelay.toFixed(0)}ms...`);
          reconnectTimeout = setTimeout(connectWebSocket, totalDelay);
          reconnectAttempt++;
        }
      };
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);



  const handleSaveKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_key: actorKey, researcher_key: researcherKey, groq_key: groqKey }),
      });
      if (response.ok) {
        setKeysSaved(true);
        setTimeout(() => setKeysSaved(false), 3000);
      } else {
        const errorText = await response.text();
        console.error('Failed to save keys:', response.status, errorText);
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (err) {
      console.error('Error saving keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleControlAction = async (action: string) => {
    setLoading(true);
    try {
      await fetch(`${baseUrl}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await fetchState(); // Refresh immediately
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {stats?.circuit_breaker_active && (
          <div className="bg-rose-900/50 border border-rose-500 rounded-lg p-4 flex items-center gap-4 animate-pulse">
            <AlertTriangle className="text-rose-400 w-6 h-6" />
            <div>
              <h3 className="text-rose-400 font-bold">CIRCUIT BREAKER TRIGGERED</h3>
              <p className="text-rose-200 text-sm">Max drawdown exceeded 15%. All automated entries halted to protect capital.</p>
            </div>
          </div>
        )}

        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500">
              AI Trading Simulator
            </h1>
            <p className="text-slate-400 text-sm mt-1">Live Stream Dashboard & Agent Controls</p>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-emerald-400">System Online</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Charts & Terminal */}
          <div className="lg:col-span-2 space-y-6">
            <TradingChart />
            <AgentTerminal />
          </div>

          {/* Right Column: God Mode Controls */}
          <div className="space-y-6">

            {/* Wallet Status & Advanced Stats */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
              <h2 className="text-lg font-semibold text-white mb-4">Actor Agent State</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Est. Wallet Value</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    ${stats?.wallet_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '---'}
                  </p>
                  <p className={`text-xs mt-1 ${stats && stats.floating_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Float PnL: ${stats?.floating_pnl.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Win Rate</p>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {stats?.win_rate.toFixed(1) || '0'}%
                  </p>
                  <p className="text-slate-500 text-xs mt-1">{stats?.total_closed_trades || 0} Trades Closed</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Max Drawdown</p>
                  <p className="text-sm font-bold text-rose-400">{stats?.max_drawdown.toFixed(2) || '0'}%</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Sharpe</p>
                  <p className="text-sm font-bold text-purple-400">{stats?.sharpe_ratio.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>


            {/* Admin Controls */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-rose-500">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                God Mode Controls
              </h2>

              <div className="space-y-3 mb-6 border-b border-slate-800 pb-4">
                <h3 className="text-sm font-semibold text-slate-300">Gemini API Keys</h3>
                <input
                  type="password"
                  placeholder="Actor Agent Key"
                  value={actorKey}
                  onChange={(e) => setActorKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="password"
                  placeholder="Researcher Agent Key"
                  value={researcherKey}
                  onChange={(e) => setResearcherKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="password"
                  placeholder="Groq API Key (Actor Fallback)"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSaveKeys}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  <span>{keysSaved ? 'Saved!' : 'Save Keys'}</span>
                </button>
              </div>

              <div className="space-y-3">

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleControlAction('trigger_trade')}
                    disabled={loading}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Force Entry</span>
                  </button>
                  <button
                    onClick={() => handleControlAction('close_trade')}
                    disabled={loading || activeTrades.length === 0}
                    className="w-full flex items-center justify-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Force Exit</span>
                  </button>
                </div>
                <button
                  onClick={() => handleControlAction('reset_wallet')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reset Wallet Balance</span>
                </button>
              </div>
            </div>

            {/* Active & Recent Trades */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg h-[350px] overflow-hidden flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4">Trade Breakdown</h2>
              <div className="overflow-y-auto flex-1 space-y-4 pr-2">

                {/* Active Trades */}
                {activeTrades.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 pb-1">Active Positions ({activeTrades.length})</h3>
                    {activeTrades.map((trade) => {
                      const isLong = trade.direction === "LONG";
                      const colorClass = isLong ? "text-emerald-400" : "text-rose-400";
                      const borderClass = isLong ? "border-emerald-900/50" : "border-rose-900/50";
                      const bgClass = isLong ? "bg-emerald-500" : "bg-rose-500";

                      return (
                        <div key={trade.id} className={`bg-slate-950 p-3 rounded-lg border ${borderClass} relative overflow-hidden text-sm`}>
                          <div className={`absolute top-0 left-0 w-1 h-full ${bgClass} animate-pulse`}></div>
                          <div className="flex justify-between items-center mb-1 pl-2">
                            <span className={`font-semibold ${colorClass}`}>
                              {trade.symbol}
                              <span className="text-xs ml-1 bg-slate-800 px-1 py-0.5 rounded">{trade.direction || "LONG"} {trade.leverage || 1}x</span>
                            </span>
                            <span className="text-xs text-slate-400">Entry: ${trade.entry_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[10px] pl-2 mt-1 border-t border-slate-800 pt-1">
                            <span>Liq: ${trade.liquidation_price?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2}) || '---'}</span>
                            <span>Margin: ${trade.amount_usd.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Historical Trades */}
                <div className="space-y-2">
                  <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 pb-1">Trade History</h3>
                  {historyTrades.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center mt-4">No closed trades.</p>
                  ) : (
                    historyTrades.map((trade) => (
                      <div key={trade.id} className={`bg-slate-950 p-3 rounded-lg border ${trade.status === 'liquidated' ? 'border-rose-900/80' : 'border-slate-800'} text-sm`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-slate-300">
                            {trade.symbol}
                            <span className="text-xs ml-1 bg-slate-800 px-1 py-0.5 rounded text-slate-400">{trade.direction || "LONG"} {trade.leverage || 1}x</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${trade.status === 'liquidated' ? 'bg-rose-900/80 text-white' : (trade.pnl && trade.pnl > 0 ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400')}`}>
                            {trade.status === 'liquidated' ? 'LIQUIDATED' : (trade.pnl && trade.pnl > 0 ? 'WIN' : 'LOSS')}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-xs">
                          <span>In: ${trade.entry_price.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
                          <span>Out: ${trade.exit_price?.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
                        </div>
                        <div className="flex justify-between mt-2 text-xs border-t border-slate-800 pt-1">
                           <span className="text-slate-500">Margin: ${trade.amount_usd.toFixed(2)}</span>
                           <span className={`font-bold ${trade.pnl && trade.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {trade.pnl && trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2)}
                           </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* Strategy & Analysis Row */}
        <StrategyAnalysisPanel />

      </div>
    </main>
  );
}