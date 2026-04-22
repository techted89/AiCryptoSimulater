'use client';

import React from 'react';
import { Database, Activity } from 'lucide-react';

interface GeminiStatePanelProps {
  data: {
    db_size: number;
    recent_snapshots: any[];
  } | undefined;
}

export default function GeminiStatePanel({ data }: GeminiStatePanelProps) {
  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/20 shadow-lg flex flex-col h-full">
      <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-3">
        <Database className="w-5 h-5 text-secondary" />
        Gemini Ingestor & Memory State
      </h2>

      {!data ? (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-outline text-sm animate-pulse flex items-center gap-2"><Activity className="w-4 h-4 animate-spin"/> Syncing with ChromaDB...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-surface-container-highest p-3 rounded-lg border border-outline-variant/10">
                <span className="text-xs uppercase tracking-widest text-outline font-bold">Vector DB Size</span>
                <span className="text-secondary font-mono font-bold text-lg">{data.db_size} <span className="text-[10px] text-outline">snapshots</span></span>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Recent Snapshots</span>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {data.recent_snapshots && data.recent_snapshots.length > 0 ? (
                        [...data.recent_snapshots].reverse().map((snap, idx) => (
                            <div key={idx} className="bg-surface-container-lowest p-2 rounded border border-outline-variant/5 text-[10px] font-mono">
                                <div className="flex justify-between text-outline mb-1">
                                    <span>{new Date(snap.timestamp).toLocaleTimeString()}</span>
                                    <span className={snap.success === 'True' ? 'text-secondary' : snap.success === 'False' ? 'text-error' : 'text-primary-fixed-dim'}>
                                        {snap.success === 'True' ? 'WIN' : snap.success === 'False' ? 'LOSS' : 'PENDING'}
                                    </span>
                                </div>
                                <div className="text-on-surface-variant flex gap-2 flex-wrap">
                                    <span>Price: ${snap.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    <span>RSI: {snap.rsi.toFixed(1)}</span>
                                    <span>MACD: {snap.macd.toFixed(2)}</span>
                                    {snap.news && snap.news !== "Neutral" && <span className="text-orange-400">News: {snap.news}</span>}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-outline/50 text-center py-4">No recent snapshots found.</div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
