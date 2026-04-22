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
      let color = "text-on-surface-variant";
      if (/bullish|favorable/i.test(line)) color = "text-secondary";
      if (/bearish|caution/i.test(line)) color = "text-error";
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
      <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/20 shadow-lg">
        <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-tertiary-fixed-dim" />
          Trade Strategy Details
        </h2>
        {strategy ? (
          <div className="space-y-4">
            <div>
              <p className="text-outline text-xs uppercase tracking-wider">Strategy Name</p>
              <p className="text-on-surface font-medium">{strategy.name}</p>
            </div>
            <div>
              <p className="text-outline text-xs uppercase tracking-wider">Description</p>
              <p className="text-on-surface-variant text-sm mt-1">{strategy.description}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-outline text-xs uppercase tracking-wider mb-1">Indicators</p>
                <div className="flex flex-wrap gap-2">
                  {strategy.indicators.map((ind, i) => (
                    <span key={i} className="bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim text-[10px] px-2 py-1 rounded border border-tertiary-fixed-dim/20">
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-outline text-xs uppercase tracking-wider mb-1">Risk Profile</p>
                <span className="bg-orange-900/50 text-orange-400 text-[10px] px-2 py-1 rounded border border-orange-800 uppercase font-bold">
                  {strategy.risk_profile}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-outline text-sm animate-pulse">Loading strategy...</p>
        )}
      </div>

      {/* Market Analysis Feed */}
      <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/20 shadow-lg">
        <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Real-Time Market Analysis
        </h2>
        {analysis ? (
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/20 p-4 h-[200px] overflow-y-auto font-mono text-sm">
            {analysisLines}
          </div>
        ) : (
          <div className="h-[200px] bg-surface-container-lowest rounded-lg border border-outline-variant/20 flex items-center justify-center">
            <p className="text-outline text-sm animate-pulse">Analyzing market data...</p>
          </div>
        )}
      </div>
    </div>
  );
}