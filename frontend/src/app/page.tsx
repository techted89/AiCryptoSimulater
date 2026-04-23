'use client';

import React, { useState, useEffect } from 'react';
import TradingChart from '../components/TradingChart';
import GeminiStatePanel from '../components/GeminiStatePanel';
import GroqStrategyPanel from '../components/GroqStrategyPanel';
import OllamaExecutionPanel from '../components/OllamaExecutionPanel';
import { RefreshCw, Zap, XCircle } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'strategy'>('dashboard');
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [researcherKey, setResearcherKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [loading, setLoading] = useState(false);

  const [agentState, setAgentState] = useState<any>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let isConnecting = false;

    const connect = () => {
      if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) return;
      isConnecting = true;
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      ws = new WebSocket(`${wsUrl}/ws/state`);

      ws.onopen = () => {
        isConnecting = false;
        console.log('Connected to agent state stream');
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setAgentState(parsed);
        } catch (err) {
          console.error("Parse state error:", err);
        }
      };

      ws.onclose = () => {
        isConnecting = false;
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        isConnecting = false;
        if (ws) ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const handleSaveKeys = async () => {
    try {
      await fetch('http://localhost:8000/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ researcher_key: researcherKey, groq_key: groqKey })
      });
      alert('Keys updated successfully (Memory only)');
      setApiModalOpen(false);
    } catch (e) {
      alert('Failed to update keys');
    }
  };

  const handleResetWallet = async () => {
    try {
      await fetch(`${baseUrl}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_wallet' })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerTrade = async () => {
      try {
          await fetch(`${baseUrl}/api/control`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'trigger_trade' })
          });
      } catch (e) {
          console.error(e);
      }
  };

  const handleCloseTrade = async () => {
      try {
          await fetch(`${baseUrl}/api/control`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'close_trade' })
          });
      } catch (e) {
          console.error(e);
      }
  };


  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-secondary/30 selection:text-secondary-fixed pt-16 pb-12 flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0e14]/90 backdrop-blur-md border-b border-[#3b494b]/30 h-16 flex items-center px-6 shadow-xl">
        <div className="flex items-center gap-3 mr-12">
          <div className="w-8 h-8 bg-gradient-to-br from-[#00F0FF] to-[#05e777] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
             <span className="material-symbols-outlined text-[#0a0e14] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
          </div>
          <span className="font-headline font-bold text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">AiCryptoSim</span>
        </div>

        <div className="flex gap-2 bg-[#121a21] p-1 rounded-lg border border-[#3b494b]/50">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold tracking-wider uppercase transition-all ${activeTab === 'dashboard' ? 'bg-[#00F0FF]/10 text-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'text-[#849495] hover:text-[#e2e8f0]'}`}
          >
            Live Monitor
          </button>
          <button
            onClick={() => setActiveTab('strategy')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold tracking-wider uppercase transition-all ${activeTab === 'strategy' ? 'bg-[#05e777]/10 text-[#05e777] shadow-[0_0_10px_rgba(5,231,119,0.2)]' : 'text-[#849495] hover:text-[#e2e8f0]'}`}
          >
            System Settings
          </button>
        </div>

        <div className="ml-auto flex items-center gap-4">
           {/* Global Wallet Display */}
           <div className="bg-[#121a21] border border-[#3b494b]/50 px-4 py-1.5 rounded-lg flex items-center gap-3 hidden md:flex">
             <span className="material-symbols-outlined text-[#05e777] text-lg">account_balance_wallet</span>
             <span className="font-mono font-bold text-[#e2e8f0]">
                ${agentState?.ollama?.stats?.wallet_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '---'}
             </span>
             <span className={`text-xs font-mono font-bold ${agentState?.ollama?.stats?.floating_pnl >= 0 ? 'text-[#05e777]' : 'text-[#ffb4ab]'}`}>
                {agentState?.ollama?.stats?.floating_pnl >= 0 ? '+' : ''}{agentState?.ollama?.stats?.floating_pnl?.toFixed(2) || '0.00'}
             </span>
           </div>

           <button className="w-10 h-10 rounded-full bg-[#121a21] border border-[#3b494b]/50 flex items-center justify-center text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors shadow-[0_0_10px_rgba(0,240,255,0.1)]">
             <span className="material-symbols-outlined">notifications</span>
           </button>
           <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3b494b] to-[#849495] border-2 border-[#121a21] cursor-pointer"></div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="p-6 flex-1 flex flex-col">
        {activeTab === 'dashboard' && (
          <div className="max-w-[1600px] mx-auto w-full space-y-6 flex-1 flex flex-col">
             {/* Top Row: Price Stream & Gemini State */}
             <div className="grid grid-cols-12 gap-6 h-[400px]">
                 <div className="col-span-12 lg:col-span-8 h-full">
                     <TradingChart />
                 </div>
                 <div className="col-span-12 lg:col-span-4 h-full">
                     <GeminiStatePanel data={agentState?.gemini} />
                 </div>
             </div>

             {/* Bottom Row: Groq Strategy & Ollama Execution */}
             <div className="grid grid-cols-12 gap-6 h-[450px]">
                  <GroqStrategyPanel data={agentState?.groq} />
                  <OllamaExecutionPanel
                      data={{
                          stats: agentState?.ollama?.stats,
                          trades: agentState?.ollama?.trades,
                      }}
                  />
             </div>

             {/* Dev Controls */}
             <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/10 mt-auto justify-center">
                 <button onClick={handleTriggerTrade} className="px-4 py-2 bg-primary/20 text-primary border border-primary/50 rounded font-bold uppercase text-xs hover:bg-primary/30 transition-colors flex items-center gap-2"><Zap className="w-3 h-3"/> Force RAG Trade</button>
                 <button onClick={handleCloseTrade} className="px-4 py-2 bg-error/20 text-error border border-error/50 rounded font-bold uppercase text-xs hover:bg-error/30 transition-colors flex items-center gap-2"><XCircle className="w-3 h-3"/> Force Close Oldest</button>
                 <button onClick={handleResetWallet} className="px-4 py-2 bg-outline-variant/20 text-outline border border-outline-variant/50 rounded font-bold uppercase text-xs hover:bg-outline-variant/30 transition-colors flex items-center gap-2"><RefreshCw className="w-3 h-3"/> Reset Simulation</button>
             </div>
          </div>
        )}

        {activeTab === 'strategy' && (
           <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 pt-4 w-full">
             <div className="col-span-12 lg:col-span-8 space-y-6">
                 <div className="bg-surface-container rounded-xl overflow-hidden shadow-xl border border-outline-variant/20">
                     <div className="bg-surface-container-high px-6 py-4 flex justify-between items-center border-b border-outline-variant/10">
                         <h2 className="font-headline font-bold tracking-wide flex items-center gap-2"><span className="material-symbols-outlined text-secondary">smart_toy</span>LLM ENGINE CONNECTORS</h2>
                     </div>
                     <div className="p-8">
                         <button onClick={() => setApiModalOpen(true)} className="px-6 py-2 bg-secondary text-on-secondary text-[10px] font-extrabold uppercase hover:shadow-[0_0_15px_rgba(5,231,119,0.3)] transition-all rounded">Edit Keys</button>
                     </div>
                 </div>
             </div>
           </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e14] h-8 flex justify-between items-center px-6 border-t border-[#3b494b]/15">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#05e777]">SYSTEM STATUS: OPERATIONAL // LATENCY 12MS</span>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest">
          <span className="text-[#849495] hover:text-[#00F0FF] transition-colors cursor-default">API status</span>
          <span className="text-[#849495] hover:text-[#00F0FF] transition-colors cursor-default">Ollama Llama3.2</span>
          <span className="text-[#849495] hover:text-[#00F0FF] transition-colors cursor-default">Gemini Pro</span>
        </div>
      </footer>

      {/* Settings Modal */}
      {apiModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" id="api-modal">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setApiModalOpen(false)}></div>
          <div className="relative glass-panel w-full max-w-lg rounded-2xl border border-outline-variant/30 shadow-2xl overflow-hidden bg-surface-container">
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
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase monospaced">Researcher Agent Key (Gemini)</label>
                  <input type="password" value={researcherKey} onChange={(e) => setResearcherKey(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm monospaced focus:border-primary-container outline-none transition-all text-on-surface" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase monospaced">Groq Fallback Key</label>
                  <input type="password" value={groqKey} onChange={(e) => setGroqKey(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm monospaced focus:border-primary-container outline-none transition-all text-on-surface" />
                </div>
                <div className="pt-2">
                    <p className="text-xs text-outline italic">Note: The Actor Agent (Execution) runs locally via Ollama on port 11434 and does not require an API key.</p>
                </div>
              </div>
              <div className="mt-10 flex gap-4">
                <button disabled={loading} onClick={() => { handleSaveKeys(); }} className="flex-grow py-4 bg-primary text-on-primary text-xs font-black uppercase tracking-[0.2em] rounded-lg hover:brightness-110 transition-colors disabled:opacity-50">UPDATE VAULT</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
