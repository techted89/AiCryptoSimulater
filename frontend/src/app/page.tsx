'use client';

import React, { useEffect, useState } from 'react';
import TradingChart from '@/components/TradingChart';
import { RefreshCw, Zap, Activity } from 'lucide-react';

interface AgentStats {
  balance: number;
  total_trades: number;
}

interface Trade {
  symbol: string;
  entry_price: number;
  amount_usd: number;
  confidence: number;
  status: string;
}

export default function Home() {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchState = async () => {
    try {
      const statsRes = await fetch('http://localhost:8000/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      const tradesRes = await fetch('http://localhost:8000/api/trades');
      const tradesData = await tradesRes.json();
      setTrades(tradesData.trades.reverse()); // Newest first
    } catch (err) {
      console.error("Failed to fetch state:", err);
    }
  };

  // Poll for state every 2 seconds
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleControlAction = async (action: string) => {
    setLoading(true);
    try {
      await fetch('http://localhost:8000/api/control', {
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

          {/* Left Column: Charts */}
          <div className="lg:col-span-2">
            <TradingChart />
          </div>

          {/* Right Column: God Mode Controls */}
          <div className="space-y-6">

            {/* Wallet Status */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
              <h2 className="text-lg font-semibold text-white mb-4">Actor Agent State</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Mock Wallet</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    ${stats?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '---'}
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Total Trades</p>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {stats?.total_trades ?? '---'}
                  </p>
                </div>
              </div>
            </div>

            {/* Admin Controls */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-rose-500">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                God Mode Controls
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => handleControlAction('trigger_trade')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  <span>Force Mock Trade</span>
                </button>
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

            {/* Trade Log */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg h-[300px] overflow-hidden flex flex-col">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Trades</h2>
              <div className="overflow-y-auto flex-1 space-y-3 pr-2">
                {trades.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center mt-8">No trades recorded yet.</p>
                ) : (
                  trades.map((trade, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-emerald-400">{trade.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${trade.status === 'executed' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}`}>
                          {trade.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-xs">
                        <span>Entry: ${trade.entry_price.toLocaleString()}</span>
                        <span>Size: ${trade.amount_usd.toFixed(2)}</span>
                      </div>
                      <div className="mt-2 text-xs text-blue-400">
                        Agent Confidence: {(trade.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}