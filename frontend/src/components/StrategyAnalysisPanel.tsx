'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Target, BookOpen } from 'lucide-react';

interface StrategyDetails {
  name: string;
  description: string;
  indicators: string[];
  risk_profile: string;
}

interface AnalysisData {
  text: string;
}

export default function StrategyAnalysisPanel() {
  const [strategy, setStrategy] = useState<StrategyDetails | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);

  const analysisLines = useMemo(() => {
    if (!analysis?.text) return null;
    return analysis.text.split('\n').map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      let color = "text-slate-300";
      if (/bullish|favorable/i.test(line)) color = "text-emerald-400";
      if (/bearish|caution/i.test(line)) color = "text-rose-400";
      if (/recommendation:/i.test(line)) return <p key={i} className={"mt-2 font-bold " + color}>{line}</p>;
      return <p key={i} className={color}>{line}</p>;
    });
  }, [analysis?.text]);

  const fetchData = async () => {
    try {
      const [stratRes, analysisRes] = await Promise.all([
        fetch('http://localhost:8000/api/strategy'),
        fetch('http://localhost:8000/api/analysis')
      ]);
      setStrategy(await stratRes.json());
      setAnalysis(await analysisRes.json());
    } catch (err) {
      console.error("Failed to fetch strategy/analysis:", err);
    }
  };

  useEffect(() => {
    // Initial fetch in a timeout to avoid sync state update in effect warning
    setTimeout(fetchData, 0);
    const interval = setInterval(fetchData, 3000); // Poll every 3s for analysis updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      {/* Strategy Details */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Trade Strategy Details
        </h2>
        {strategy ? (
          <div className="space-y-4">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider">Strategy Name</p>
              <p className="text-white font-medium">{strategy.name}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider">Description</p>
              <p className="text-slate-300 text-sm mt-1">{strategy.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 mt-4">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Indicators</p>
                <div className="space-y-3">
                  <div>
                    <label className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>RSI Period</span>
                      <span className="text-blue-400 font-mono">14</span>
                    </label>
                    <input type="range" min="7" max="28" defaultValue="14" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div>
                    <label className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Oversold / Overbought</span>
                      <span className="text-blue-400 font-mono">30 / 70</span>
                    </label>
                    <input type="range" min="10" max="40" defaultValue="30" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Risk Parameters</p>
                <div className="space-y-3">
                  <div>
                    <label className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Max Drawdown (%)</span>
                      <span className="text-orange-400 font-mono">5.0%</span>
                    </label>
                    <input type="range" min="1" max="20" defaultValue="5" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div>
                    <label className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Position Sizing (%)</span>
                      <span className="text-orange-400 font-mono">2.5%</span>
                    </label>
                    <input type="range" min="0.5" max="10" step="0.5" defaultValue="2.5" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm animate-pulse">Loading strategy...</p>
        )}
      </div>

      {/* Market Analysis Feed */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-400" />
          Real-Time Market Analysis
        </h2>
        {analysis ? (
          <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 h-[200px] overflow-y-auto font-mono text-sm">
            {analysisLines}
          </div>
        ) : (
          <div className="h-[200px] bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center">
            <p className="text-slate-500 text-sm animate-pulse">Analyzing market data...</p>
          </div>
        )}
      </div>
    </div>
  );
}