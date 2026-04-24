'use client';

import React from 'react';
import { Bot, ShieldAlert, Activity } from 'lucide-react';

interface Trade {
    id: string;
    symbol: string;
    entry_price: number;
    amount_usd: number;
    pnl?: number;
    status: string;
    confidence: number;
}

interface OllamaExecutionPanelProps {
  data: {
    stats?: {
        balance: number;
        wallet_value: number;
        floating_pnl: number;
        win_rate: number;
        max_drawdown: number;
        circuit_breaker_active: boolean;
    };
    trades?: {
        active?: Trade[];
        history?: Trade[];
    };
    l2_book?: {
        bids: number[][];
        asks: number[][];
    };
    currentPrice?: number;
  } | undefined;
}

export default function OllamaExecutionPanel({ data }: OllamaExecutionPanelProps) {

  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/20 shadow-lg flex flex-col h-full col-span-12 lg:col-span-4">
      <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3 mb-4">
          <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
            <Bot className="w-5 h-5 text-tertiary-fixed-dim" />
            Ollama Execution Engine
          </h2>
          {data?.stats?.circuit_breaker_active && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-error bg-error/10 px-2 py-0.5 rounded border border-error/50">
                  <ShieldAlert className="w-3 h-3"/> Halted
              </span>
          )}
      </div>

      {!data ? (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-outline text-sm animate-pulse flex items-center gap-2"><Activity className="w-4 h-4 animate-spin"/> Awaiting execution state...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-1">
            {/* Risk Pre-Flight Checks */}
            <div className="bg-surface-container-highest p-4 rounded-lg border border-outline-variant/10">
                 <h3 className="text-xs uppercase tracking-widest text-outline font-bold mb-3">Pre-Flight Risk Metrics</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-[10px] text-outline uppercase tracking-wider mb-1">Max Drawdown</div>
                        <div className={`text-lg font-mono font-bold ${(data.stats?.max_drawdown || 0) > 10 ? 'text-error' : 'text-on-surface'}`}>
                            {(data.stats?.max_drawdown || 0).toFixed(2)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-outline uppercase tracking-wider mb-1">Win Rate</div>
                        <div className={`text-lg font-mono font-bold ${(data.stats?.win_rate || 0) > 50 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                            {(data.stats?.win_rate || 0).toFixed(1)}%
                        </div>
                    </div>
                 </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* L2 Order Book Simulation */}
                {data.l2_book && data.currentPrice && (
                    <div className="w-[120px] bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/10 flex flex-col overflow-hidden shrink-0">
                        <h3 className="text-outline font-semibold text-[10px] uppercase tracking-wider mb-2 text-center">L2 Depth</h3>
                        <div className="flex-1 flex flex-col text-[9px] font-mono justify-center gap-0.5">
                            {/* Asks (Sell Orders - Red) */}
                            <div className="flex flex-col-reverse gap-[1px]">
                                {data.l2_book.asks.slice(0, 5).map((ask, i) => {
                                    const maxAskVol = Math.max(...data.l2_book!.asks.map(a => a[1]), 1);
                                    return (
                                    <div key={`ask-${i}`} className="flex justify-between text-error relative px-1">
                                        <div className="absolute right-0 top-0 h-full bg-rose-900/20" style={{width: `${(ask[1]/maxAskVol)*100}%`}}></div>
                                        <span className="relative z-10">{ask[0].toFixed(1)}</span>
                                        <span className="relative z-10">{ask[1].toFixed(2)}</span>
                                    </div>
                                    );
                                })}
                            </div>

                            {/* Spread Marker */}
                            <div className="text-center text-slate-400 py-1 my-0.5 border-y border-outline-variant/20 bg-surface-container-lowest font-bold">
                                ${data.currentPrice.toFixed(1)}
                            </div>

                            {/* Bids (Buy Orders - Green) */}
                            <div className="flex flex-col gap-[1px]">
                                {data.l2_book.bids.slice(0, 5).map((bid, i) => {
                                    const maxBidVol = Math.max(...data.l2_book!.bids.map(b => b[1]), 1);
                                    return (
                                    <div key={`bid-${i}`} className="flex justify-between text-secondary relative px-1">
                                        <div className="absolute right-0 top-0 h-full bg-emerald-900/20" style={{width: `${(bid[1]/maxBidVol)*100}%`}}></div>
                                        <span className="relative z-10">{bid[0].toFixed(1)}</span>
                                        <span className="relative z-10">{bid[1].toFixed(2)}</span>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Open Orders / Positions Tab */}
                <div className="flex-1 bg-surface-container-lowest rounded-lg border border-outline-variant/10 p-3 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-outline-variant/10">
                        <h3 className="text-[10px] uppercase tracking-widest text-outline font-bold">Active Positions ({(data.trades?.active?.length || 0)})</h3>
                        <div className="text-[9px] font-mono text-outline">
                            Wallet: <span className="text-primary-fixed-dim">${data.stats?.wallet_value?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '---'}</span> |
                            PnL: <span className={data.stats?.floating_pnl && data.stats.floating_pnl >= 0 ? 'text-secondary' : 'text-error'}>{data.stats?.floating_pnl && data.stats.floating_pnl >= 0 ? '+' : ''}{data.stats?.floating_pnl?.toFixed(2) || '0.00'}</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                        {(data.trades?.active?.length || 0) === 0 ? (
                            <div className="text-[10px] text-outline/50 text-center py-4 italic">No open trades</div>
                        ) : (
                            <div className="space-y-2">
                                {(data.trades?.active || []).map((trade) => {
                                    // Calculate live PnL if currentPrice is available
                                    let currentPnl = 0;
                                    let pnlColor = "text-on-surface-variant";
                                    let pnlStr = "---";
                                    if (data.currentPrice && trade.entry_price > 0) {
                                        const tokens = trade.amount_usd / trade.entry_price;
                                        const val = tokens * data.currentPrice;
                                        currentPnl = val - trade.amount_usd;
                                        pnlColor = currentPnl >= 0 ? 'text-secondary' : 'text-error';
                                        pnlStr = `${currentPnl >= 0 ? '+' : ''}$${currentPnl.toFixed(2)}`;
                                    }

                                    return (
                                        <div key={trade.id} className="bg-surface-container p-2 rounded border border-outline-variant/5 text-[10px] font-mono">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-on-surface">{trade.symbol} LONG</span>
                                                <span className={`font-bold ${pnlColor}`}>{pnlStr}</span>
                                            </div>
                                            <div className="flex justify-between text-outline">
                                                <span>Entry: ${trade.entry_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                <span>Size: ${trade.amount_usd.toFixed(2)}</span>
                                            </div>
                                            <div className="mt-1 flex justify-between text-[9px]">
                                                <span className="text-primary-fixed-dim">Conf: {(trade.confidence * 100).toFixed(1)}%</span>
                                                <span className="text-secondary animate-pulse">ACTIVE</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <h3 className="text-[10px] uppercase tracking-widest text-outline font-bold mt-4 mb-2 pb-2 border-b border-outline-variant/10">Recent History ({(data.trades?.history?.length || 0)})</h3>
                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 max-h-[100px]">
                        {(data.trades?.history?.length || 0) === 0 ? (
                            <div className="text-[10px] text-outline/50 text-center py-4 italic">No recent trades</div>
                        ) : (
                            <div className="space-y-2">
                                {(data.trades?.history || []).slice().reverse().map((trade) => {
                                    const isWin = trade.pnl && trade.pnl >= 0;
                                    return (
                                        <div key={trade.id} className="bg-surface-container-lowest p-2 rounded border border-outline-variant/5 text-[9px] font-mono">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-on-surface-variant">{trade.symbol}</span>
                                                <span className={`font-bold ${isWin ? 'text-secondary' : 'text-error'}`}>
                                                    {isWin ? '+' : ''}{trade.pnl?.toFixed(2) || '---'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-outline/70">
                                                <span>Entry: ${trade.entry_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                <span>Size: ${trade.amount_usd.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
