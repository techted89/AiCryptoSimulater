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
  quoted_price?: number;
  entry_price: number;
  exit_price?: number;
  slippage_pct?: number;
  fee_usd?: number;
  exit_fee_usd?: number;
  amount_usd: number;
  pnl?: number;
  confidence: number;
  status: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [historyTrades, setHistoryTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [actorKey, setActorKey] = useState('');
  const [researcherKey, setResearcherKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [keysSaved, setKeysSaved] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);

  // Determine dynamic base URLs for the backend API and WS
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;

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
    if (!adminToken) {
      console.error('Failed to save keys: NEXT_PUBLIC_ADMIN_TOKEN is not set in the environment.');
      alert('Failed: Admin token is missing. Please configure your environment.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
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
    <div className="bg-background text-on-background min-h-screen selection:bg-primary-container selection:text-on-primary-container flex flex-col">
      {/* TopNavBar */}
      <nav className="flex justify-between items-center w-full px-6 py-3 h-16 bg-gradient-to-r from-[#1c2026] to-[#0a0e14] z-50 fixed top-0 border-b border-outline-variant/10">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-[#dbfcff] uppercase font-headline">KINETIC VAULT</span>
          <div className="hidden md:flex gap-6 items-center font-label text-sm uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`transition-colors ${activeTab === 'dashboard' ? 'text-[#00F0FF] border-b-2 border-[#00F0FF] pb-1' : 'text-[#849495] hover:text-[#dbfcff]'}`}>
              Dashboard
            </button>
            <button className="text-[#849495] hover:text-[#dbfcff] transition-colors cursor-not-allowed opacity-50">History</button>
            <button
              onClick={() => setActiveTab('strategy')}
              className={`transition-colors ${activeTab === 'strategy' ? 'text-[#00F0FF] border-b-2 border-[#00F0FF] pb-1' : 'text-[#849495] hover:text-[#dbfcff]'}`}>
              Strategy
            </button>
            <button className="text-[#849495] hover:text-[#dbfcff] transition-colors cursor-not-allowed opacity-50">Research</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="material-symbols-outlined text-outline hover:bg-[#1c2026] p-2 rounded-lg transition-all duration-300 scale-95 active:scale-90">settings</button>
          <button className="material-symbols-outlined text-outline hover:bg-[#1c2026] p-2 rounded-lg transition-all duration-300 scale-95 active:scale-90">account_circle</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 pb-12 px-4 md:px-6 flex-grow">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-12 gap-4">
            {stats?.circuit_breaker_active && (
              <div className="col-span-12 bg-error-container/20 border border-error rounded-xl p-4 flex items-center gap-4 animate-pulse">
                <AlertTriangle className="text-error w-6 h-6" />
                <div>
                  <h3 className="text-error font-bold font-headline uppercase">CIRCUIT BREAKER TRIGGERED</h3>
                  <p className="text-on-error-container text-sm">Max drawdown exceeded 15%. All automated entries halted to protect capital.</p>
                </div>
              </div>
            )}

            {/* Left Column: Agent Stats & Status */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
              {/* God Mode Active Control */}
              <div className="bg-surface-container rounded-xl p-5 border-l-4 border-primary shadow-lg shadow-primary-container/5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-1">System Status</h2>
                    <p className="text-xl font-headline font-bold text-on-surface">GOD MODE ACTIVE</p>
                  </div>
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-outline">AUTO-HEDGE</span>
                    <span className="text-secondary font-bold">ENGAGED</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                    <div className="bg-primary-container h-full shadow-[0_0_8px_rgba(0,240,255,0.6)]" style={{width: '80%'}}></div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-outline">BALANCE</span>
                    <span className="text-on-surface font-mono">${stats?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-outline">WALLET VALUE</span>
                    <span className="text-on-surface font-mono">${stats?.wallet_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                  </div>
                </div>
              </div>

              {/* Agent Performance Bento */}
              <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-outline">Agent Neural Metrics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center text-secondary">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">Alpha-Neural V2</p>
                        <p className="text-[10px] text-outline">Trades Closed: {stats?.total_closed_trades || 0}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-mono font-bold ${stats && stats.floating_pnl >= 0 ? 'text-secondary' : 'text-error'}`}>
                        {stats && stats.floating_pnl >= 0 ? '+' : ''}${stats?.floating_pnl.toFixed(2) || '0.00'} PnL
                      </p>
                      <p className="text-[10px] text-outline uppercase">Win Rate: {stats?.win_rate.toFixed(1) || '0'}%</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-tertiary-container/10 flex items-center justify-center text-tertiary-fixed-dim">
                        <span className="material-symbols-outlined text-sm">monitoring</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">Risk Metrics</p>
                        <p className="text-[10px] text-outline">Sharpe: {stats?.sharpe_ratio.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-error">Max DD: {stats?.max_drawdown.toFixed(2) || '0'}%</p>
                      <p className="text-[10px] text-outline uppercase">Stability: 99.9%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reset Wallet / Force Admin */}
              <div className="bg-surface-container rounded-xl overflow-hidden p-4">
                 <button
                    onClick={() => handleControlAction('reset_wallet')}
                    disabled={loading || !adminToken}
                    className="w-full py-2 bg-surface-container-highest text-on-surface font-bold uppercase tracking-widest rounded text-xs flex items-center justify-center gap-2 hover:bg-surface-variant transition-all disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Wallet
                  </button>
              </div>
            </div>

            {/* Middle Column: Main Chart (TradingChart inside) */}
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
               <TradingChart activeTrades={activeTrades} historyTrades={historyTrades} />
            </div>

            {/* Right Column: L2 Order Book & Execution */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
              {/* Order Entry Module */}
              <div className="glass-panel rounded-xl p-5 border border-outline-variant/10">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Terminal Execution</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => handleControlAction('trigger_trade')} disabled={loading || !adminToken} className="py-2 bg-secondary text-on-secondary font-bold uppercase tracking-widest rounded text-xs shadow-[0_4px_12px_rgba(5,231,119,0.2)] disabled:opacity-50 flex justify-center items-center gap-1"><Zap className="w-3 h-3"/> Long</button>
                  <button onClick={() => handleControlAction('close_trade')} disabled={loading || !adminToken || activeTrades.length === 0} className="py-2 bg-surface-container-highest text-on-surface font-bold uppercase tracking-widest rounded text-xs disabled:opacity-50 flex justify-center items-center gap-1"><XCircle className="w-3 h-3"/> Exit</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-outline uppercase font-bold tracking-widest mb-1 block">Quick Execution Mode</label>
                    <input readOnly className="w-full bg-surface-container-highest/50 border-0 border-b border-outline/20 focus:border-primary-fixed-dim focus:ring-0 text-sm font-mono p-2 rounded cursor-not-allowed text-outline" type="text" value="Market Order Active" />
                  </div>
                </div>
              </div>

              {/* We will let TradingChart render the L2 depth in a simplified way, or extract it here later if needed. For now TradingChart manages L2 inside it. To match the UI, let's keep it clean or just wrap AgentTerminal here */}
              <div className="flex-1 bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden min-h-[300px]">
                 <AgentTerminal />
              </div>

            </div>
          </div>
        )}

        {activeTab === 'strategy' && (
           <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 pt-4">
             {/* Header Section */}
             <header className="col-span-12 mb-4">
               <div className="flex items-end gap-3">
                 <h1 className="font-headline text-4xl font-bold tracking-tight text-primary">STRATEGY ARCHITECT</h1>
                 <div className="h-[2px] flex-grow bg-outline-variant opacity-20 mb-3"></div>
                 <div className="px-3 py-1 bg-surface-container-highest text-secondary font-mono text-[10px] tracking-widest uppercase border-l-2 border-secondary-container">V4.2.0-STABLE</div>
               </div>
             </header>

             {/* Sidebar: Asset Selection & Controls */}
             <aside className="col-span-12 lg:col-span-4 space-y-6">
               <section className="bg-surface-container rounded-xl p-6 relative overflow-hidden border-b-4 border-primary/20">
                 <div className="flex items-center justify-between mb-6">
                   <h2 className="font-headline text-lg font-medium text-on-surface">ASSET SELECTION</h2>
                   <span className="material-symbols-outlined text-primary-fixed-dim">token</span>
                 </div>
                 <div className="space-y-3">
                   <div className="bg-surface-container-high p-4 flex items-center justify-between hover:bg-surface-container-highest transition-colors cursor-pointer group">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center">
                         <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>currency_bitcoin</span>
                       </div>
                       <div>
                         <div className="font-headline font-bold text-on-surface">BTC / USDT</div>
                         <div className="text-xs text-outline monospaced">Active</div>
                       </div>
                     </div>
                     <div className="text-right">
                        <div className="monospaced text-secondary text-sm">${stats?.wallet_value.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '---'}</div>
                     </div>
                   </div>
                 </div>
               </section>

               <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
                 <div className="flex items-center gap-3 mb-4">
                   <div className="w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_rgba(5,231,119,0.6)]"></div>
                   <span className="text-xs text-on-surface-variant font-mono tracking-widest">REAL-TIME EXECUTION ENGINE</span>
                 </div>
                 <AgentTerminal />
               </section>
             </aside>

             {/* Main Configuration Area */}
             <div className="col-span-12 lg:col-span-8 space-y-6">
               <StrategyAnalysisPanel />

               {/* API Configuration Section */}
               <div className="bg-surface-container rounded-xl overflow-hidden">
                 <div className="bg-surface-container-high px-6 py-4 flex justify-between items-center">
                   <div className="flex items-center gap-2">
                     <span className="material-symbols-outlined text-tertiary-fixed-dim">api</span>
                     <h2 className="font-headline font-bold tracking-wide">LLM ENGINE CONNECTORS</h2>
                   </div>
                   <div className="flex items-center gap-4">
                     <div className="text-[10px] font-mono text-outline uppercase">Active: Gemini Pro</div>
                   </div>
                 </div>

                 <div className="p-8 space-y-6">
                   <div className="flex flex-col md:flex-row gap-6 items-start md:items-center bg-surface-container-high p-6 rounded-xl border-l-4 border-secondary shadow-lg relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 blur-3xl rounded-full translate-x-16 -translate-y-16"></div>
                     <div className="w-16 h-16 bg-surface-container-highest flex items-center justify-center rounded-xl border border-secondary/30">
                        <span className="material-symbols-outlined text-3xl text-secondary">smart_toy</span>
                     </div>
                     <div className="flex-grow">
                       <div className="flex items-center gap-2 mb-1">
                         <h4 className="font-headline font-bold text-primary">Gemini 1.5 Pro</h4>
                         <span className="text-[10px] bg-secondary-container/20 px-2 py-0.5 rounded text-secondary uppercase monospaced">Active</span>
                       </div>
                       <p className="text-xs text-on-surface-variant">Technical analysis and order orchestration agent.</p>
                     </div>
                     <div className="w-full md:w-auto flex gap-3">
                       <button onClick={() => setApiModalOpen(true)} className="flex-grow md:flex-none px-6 py-2 bg-secondary text-on-secondary text-[10px] font-extrabold uppercase hover:shadow-[0_0_15px_rgba(5,231,119,0.3)] transition-all rounded">Edit Keys</button>
                     </div>
                   </div>
                 </div>
               </div>

               <div className="flex flex-col sm:flex-row gap-4 pt-4">
                 <button onClick={handleSaveKeys} className="flex-grow h-14 bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-lg uppercase tracking-widest rounded-xl hover:brightness-110 transition-all active:scale-95 shadow-[0_8px_30px_rgb(0,240,255,0.15)]">
                   INITIALIZE STRATEGY
                 </button>
               </div>
             </div>
           </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e14] h-8 flex justify-between items-center px-6 border-t border-[#3b494b]/15">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#05e777]">SYSTEM STATUS: OPERATIONAL // LATENCY 12MS</span>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest">
          <a className="text-[#849495] hover:text-[#00F0FF] transition-colors" href="#">API status</a>
          <a className="text-[#849495] hover:text-[#00F0FF] transition-colors" href="#">Grok v2</a>
          <a className="text-[#849495] hover:text-[#00F0FF] transition-colors" href="#">Gemini Pro</a>
        </div>
      </footer>

      {/* Settings Modal (Overlay simulation) */}
      {apiModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" id="api-modal">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setApiModalOpen(false)}></div>
          <div className="relative glass-panel w-full max-w-lg rounded-2xl border border-outline-variant/30 shadow-2xl overflow-hidden">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="font-headline text-2xl font-bold text-primary">API KEY MANAGER</h2>
                  <p className="text-xs text-outline uppercase tracking-widest mt-1">Encrypted Vault Storage</p>
                </div>
                <button onClick={() => setApiModalOpen(false)} className="material-symbols-outlined text-outline hover:text-primary transition-colors">close</button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase monospaced">Actor Agent Key</label>
                  <input type="password" value={actorKey} onChange={(e) => setActorKey(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm monospaced focus:border-primary-container outline-none transition-all text-on-surface" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase monospaced">Researcher Agent Key</label>
                  <input type="password" value={researcherKey} onChange={(e) => setResearcherKey(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm monospaced focus:border-primary-container outline-none transition-all text-on-surface" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase monospaced">Groq Fallback Key</label>
                  <input type="password" value={groqKey} onChange={(e) => setGroqKey(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm monospaced focus:border-primary-container outline-none transition-all text-on-surface" />
                </div>
              </div>
              <div className="mt-10 flex gap-4">
                <button onClick={() => { handleSaveKeys(); setApiModalOpen(false); }} className="flex-grow py-4 bg-primary text-on-primary text-xs font-black uppercase tracking-[0.2em] rounded-lg hover:brightness-110 transition-colors">UPDATE VAULT</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
