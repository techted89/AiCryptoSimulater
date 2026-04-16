'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';

interface ChartDataPoint {
  time: string;
  price: number;
  rsi: number;
}

interface L2Book {
  bids: [number, number][];
  asks: [number, number][];
}

interface Macro {
  dxy: number;
  sp500: number;
}

export default function TradingChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [l2Book, setL2Book] = useState<L2Book | null>(null);
  const [macro, setMacro] = useState<Macro | null>(null);
  const [sentiment, setSentiment] = useState<string>("Neutral");
  const [timeWindow, setTimeWindow] = useState<number>(30); // Default to 30 points

  const wsRef = useRef<WebSocket | null>(null);
  const timeWindowRef = useRef(timeWindow);

  useEffect(() => {
    timeWindowRef.current = timeWindow;
  }, [timeWindow]);

  useEffect(() => {
    // Connect to the FastAPI WebSocket
    const ws = new WebSocket('ws://localhost:8000/ws/prices');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket stream');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const date = new Date(payload.timestamp * 1000);
        const timeStr = date.toLocaleTimeString([], { hour12: false, second: '2-digit' });

        setData((prev) => {
          const newData = [...prev, { time: timeStr, price: payload.price, rsi: payload.rsi }];
          // Keep only the last N data points so the chart doesn't grow infinitely
          if (timeWindowRef.current > 0 && newData.length > timeWindowRef.current) {
            return newData.slice(newData.length - timeWindowRef.current);
          }
          return newData;
        });

        if (payload.order_book) setL2Book(payload.order_book);
        if (payload.macro) setMacro(payload.macro);
        if (payload.news_sentiment) setSentiment(payload.news_sentiment);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  // Calculate a mock "Liquidation Heatmap" band based on the current price
  // We'll show this as ReferenceAreas or just plot lines if we had them,
  // but for simplicity we'll just plot a custom reference line area representing "High Leverage Longs"
  const currentPrice = data.length > 0 ? data[data.length - 1].price : 0;
  const longLiqBand = currentPrice * 0.98; // 2% drop
  const shortLiqBand = currentPrice * 1.02; // 2% pump

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      {/* Real-Time Macro & Sentiment Bar */}
      <div className="flex gap-4 p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-lg justify-between items-center text-xs">
        <div className="flex gap-6">
           <div>
             <span className="text-slate-400 uppercase">DXY (Dollar) </span>
             <span className="text-slate-200 font-mono font-bold">{macro?.dxy.toFixed(2) || '---'}</span>
           </div>
           <div>
             <span className="text-slate-400 uppercase">S&P 500 </span>
             <span className="text-slate-200 font-mono font-bold">{macro?.sp500.toFixed(2) || '---'}</span>
           </div>
        </div>
        <div>
           <span className="text-slate-400 uppercase mr-2">News Sentiment </span>
           <span className={`px-2 py-1 rounded font-bold ${sentiment.includes('Bullish') ? 'bg-emerald-900/50 text-emerald-400' : sentiment.includes('Bearish') ? 'bg-rose-900/50 text-rose-400' : 'bg-slate-800 text-slate-300'}`}>
             {sentiment.replace("_", " ")}
           </span>
        </div>
      </div>

      {/* Main UI row: Chart + L2 Order Book */}
      <div className="flex gap-4 h-[300px]">
        {/* Price Chart */}
        <div className="flex-1 bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-4">
              <h3 className="text-emerald-400 font-semibold">BTC/USD Price Live Stream</h3>
              <div className="flex gap-1">
                {[30, 100, 0].map((val) => (
                  <button
                    key={val}
                    onClick={() => setTimeWindow(val)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                      timeWindow === val
                        ? 'bg-emerald-900/50 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {val === 0 ? 'All' : `${val} Ticks`}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-amber-500 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-800">
               ⚠️ Showing Estimated Liquidation Bands (±2%)
            </span>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={12} width={100} tickFormatter={(value) => typeof value === 'number' ? `$${value.toLocaleString()}` : ''} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value: number, name: string) => {
                if (name === 'price') return [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price'];
                return [value, name];
              }}
            />
            <Legend />
            {/* Mock Liquidation Heatmaps */}
            {currentPrice > 0 && (
              <ReferenceLine y={longLiqBand} stroke="#ef4444" strokeWidth={4} strokeOpacity={0.2} label={{ position: 'insideBottomLeft', value: 'Long Liq', fill: '#ef4444', fontSize: 10 }} />
            )}
            {currentPrice > 0 && (
              <ReferenceLine y={shortLiqBand} stroke="#10b981" strokeWidth={4} strokeOpacity={0.2} label={{ position: 'insideTopLeft', value: 'Short Liq', fill: '#10b981', fontSize: 10 }} />
            )}

            <Line
              type="monotone"
              dataKey="price"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* L2 Order Book Simulation */}
        <div className="w-[200px] bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800 flex flex-col overflow-hidden">
          <h3 className="text-slate-300 font-semibold text-xs uppercase tracking-wider mb-2 border-b border-slate-800 pb-2">L2 Order Book</h3>
          <div className="flex-1 flex flex-col text-[10px] font-mono justify-center gap-1">
            {/* Asks (Sell Orders - Red) */}
            <div className="flex flex-col-reverse gap-0.5">
              {l2Book?.asks.map((ask, i) => (
                <div key={`ask-${i}`} className="flex justify-between text-rose-400 relative">
                   <div className="absolute right-0 top-0 h-full bg-rose-900/20" style={{width: `${(ask[1]/5)*100}%`}}></div>
                   <span>${ask[0].toFixed(2)}</span>
                   <span>{ask[1].toFixed(3)}</span>
                </div>
              ))}
            </div>

            {/* Spread Marker */}
            <div className="text-center text-slate-500 py-1 my-1 border-y border-slate-800 bg-slate-950 font-bold">
               ${currentPrice.toFixed(2)}
            </div>

            {/* Bids (Buy Orders - Green) */}
            <div className="flex flex-col gap-0.5">
              {l2Book?.bids.map((bid, i) => (
                <div key={`bid-${i}`} className="flex justify-between text-emerald-400 relative">
                   <div className="absolute right-0 top-0 h-full bg-emerald-900/20" style={{width: `${(bid[1]/5)*100}%`}}></div>
                   <span>${bid[0].toFixed(2)}</span>
                   <span>{bid[1].toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RSI Chart */}
      <div className="h-[200px] w-full bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800">
        <h3 className="text-blue-400 font-semibold mb-2">RSI (Relative Strength Index)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value: number, name: string) => {
                if (name === 'rsi') return [value.toFixed(2), 'RSI'];
                return [value, name];
              }}
            />
            {/* Overbought/Oversold lines */}
            <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}