'use client';

import React, { useMemo } from 'react';
import { BrainCircuit, Target, Terminal } from 'lucide-react';

interface StrategyDetails {
  name: string;
  description: string;
  indicators: string[];
  risk_profile: string;
}

interface GroqStatePanelProps {
  data: {
    active_strategy: StrategyDetails;
    latest_analysis: string;
    confidence_score: number;
    thought_log: string[];
  } | undefined;
}

export default function GroqStrategyPanel({ data }: GroqStatePanelProps) {

  const analysisLines = useMemo(() => {
    if (!data?.latest_analysis) return null;
    return data.latest_analysis.split('\n').map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      let color = "text-on-surface-variant";
      if (/bullish|favorable|buy/i.test(line)) color = "text-secondary";
      if (/bearish|caution|sell|pressure/i.test(line)) color = "text-error";
      if (/recommendation:/i.test(line)) return <p key={i} className={"mt-2 font-bold " + color}>{line}</p>;
      return <p key={i} className={color}>{line}</p>;
    });
  }, [data?.latest_analysis]);

  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/20 shadow-lg flex flex-col h-full col-span-12 lg:col-span-8">
      <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3 mb-4">
          <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            Groq RAG Analyst & Strategist
          </h2>
          {data && (
              <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Confidence</span>
                  <div className={`px-3 py-1 rounded font-mono font-bold text-sm ${data.confidence_score > 0.7 ? 'bg-secondary/20 text-secondary border border-secondary/50' : data.confidence_score < 0.4 ? 'bg-error/20 text-error border border-error/50' : 'bg-surface-variant text-on-surface'}`}>
                      {(data.confidence_score * 100).toFixed(1)}%
                  </div>
              </div>
          )}
      </div>

      {!data ? (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-outline text-sm animate-pulse">Awaiting strategy formulation...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            {/* Left: Active Strategy Details */}
            <div className="flex flex-col gap-4">
                <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/10">
                    <h3 className="text-xs uppercase tracking-widest text-outline font-bold flex items-center gap-2 mb-2"><Target className="w-4 h-4"/> Active Strategy</h3>
                    <p className="text-on-surface font-medium text-sm mb-1">{data.active_strategy.name}</p>
                    <p className="text-on-surface-variant text-[11px] leading-relaxed mb-3">{data.active_strategy.description}</p>
                    <div className="flex flex-wrap gap-1">
                        {data.active_strategy.indicators.map((ind, i) => (
                            <span key={i} className="bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim text-[9px] px-1.5 py-0.5 rounded border border-tertiary-fixed-dim/20 uppercase">
                                {ind}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex-1 bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10 overflow-hidden flex flex-col">
                    <h3 className="text-xs uppercase tracking-widest text-outline font-bold mb-2">Market Analysis</h3>
                    <div className="flex-1 overflow-y-auto font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate-700 pr-2">
                        {analysisLines}
                    </div>
                </div>
            </div>

            {/* Right: Thought Stream Terminal */}
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/10 flex flex-col font-mono text-[10px]">
                <h3 className="text-xs uppercase tracking-widest text-outline font-bold flex items-center gap-2 mb-2 pb-2 border-b border-outline-variant/10"><Terminal className="w-4 h-4"/> Thought Stream</h3>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                    {data.thought_log.length === 0 ? (
                        <p className="text-outline/50 animate-pulse">&gt; Processing...</p>
                    ) : (
                        data.thought_log.map((thought, idx) => {
                            let color = "text-on-surface-variant";
                            if (thought.includes("Failed") || thought.includes("unavailable")) color = "text-error";
                            else if (thought.includes("win rate") || thought.includes("+")) color = "text-secondary";
                            else if (thought.includes("overbought") || thought.includes("-")) color = "text-orange-400";
                            else if (thought.includes("Confidence Score:")) color = "text-primary font-bold";

                            return (
                                <p key={idx} className={`${color} leading-relaxed break-words`}>
                                    <span className="text-outline/50 mr-2">&gt;</span>
                                    {thought}
                                </p>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
