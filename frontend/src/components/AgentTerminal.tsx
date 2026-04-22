'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Terminal } from 'lucide-react';

export default function AgentTerminal() {
  const [thoughts, setThoughts] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchThoughts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/thoughts');
      const data = await res.json();
      // Reverse so newest is at the bottom for a terminal feel
      setThoughts([...data.thoughts].reverse());
    } catch (err) {
      console.error("Failed to fetch thoughts:", err);
    }
  };

  useEffect(() => {
    setTimeout(fetchThoughts, 0);
    const interval = setInterval(fetchThoughts, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new thoughts arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts]);

  return (
    <div className="bg-transparent p-4 rounded-xl font-mono text-xs flex flex-col h-[250px]">
      <div className="flex items-center gap-2 mb-3 text-outline border-b border-outline-variant/10 pb-2">
        <Terminal className="w-4 h-4" />
        <span className="uppercase tracking-widest font-semibold">Agent Thought Stream</span>
        <span className="ml-auto flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-slate-700"
      >
        {thoughts.length === 0 ? (
          <p className="text-outline/50 animate-pulse">&gt; Awaiting market data ingestion...</p>
        ) : (
          thoughts.map((thought, idx) => {
            // Apply simple color coding based on keywords
            let color = "text-on-surface-variant";
            if (thought.includes("Error") || thought.includes("Failed")) color = "text-error";
            else if (thought.includes("win rate") || thought.includes("+")) color = "text-secondary";
            else if (thought.includes("overbought") || thought.includes("-0.2")) color = "text-primary-fixed-dim";
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
  );
}